-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICATION FUNNEL — server logic (RPCs, storage, lifecycle)
-- ════════════════════════════════════════════════════════════════════════════
-- Depends on schema.sql + verification.sql. Re-runnable (CREATE OR REPLACE).
--
-- Funnel flow:
--   create_submission ──▶ status pending_ml
--   ingest_ml_result  ──▶ clean+token+reps  ⇒ auto_approved   (still peer-flaggable)
--                          else              ⇒ in_review ─▶ assign_reviewers
--   submit_flag       ──▶ weighted pressure ≥ threshold ⇒ in_review ─▶ assign_reviewers
--   submit_review     ──▶ quorum reached ⇒ approved / rejected (binding)
--                          ⇒ flags resolved ⇒ flagger reputation updated
-- ════════════════════════════════════════════════════════════════════════════


-- ─── Paid-reviewer flag on profiles (optional pool) ──────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_reviewer BOOLEAN NOT NULL DEFAULT FALSE;


-- ─── Points ledger writer (service role only) ────────────────────────────────
CREATE OR REPLACE FUNCTION post_ledger(
  p_user_id UUID, p_challenge_id UUID, p_type ledger_entry_type, p_amount NUMERIC, p_ref TEXT DEFAULT NULL
) RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id BIGINT;
BEGIN
  INSERT INTO points_ledger (user_id, challenge_id, entry_type, amount, ref)
  VALUES (p_user_id, p_challenge_id, p_type, p_amount, p_ref)
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;


-- ─── Daily token generation ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION gen_token_text()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  adj TEXT[] := ARRAY['amber','brisk','cobalt','dawn','ember','frost','golden','hazel',
                      'ivory','jade','lunar','maple','noble','ocean','pearl','quartz',
                      'rapid','silver','tidal','umber','vivid','willow','zephyr'];
  nz  TEXT[] := ARRAY['otter','falcon','cedar','comet','harbor','lantern','meadow','pebble',
                      'ridge','summit','thistle','willow','anchor','beacon','canyon','delta'];
BEGIN
  RETURN adj[1 + floor(random()*array_length(adj,1))::int] || '-'
      || nz[1 + floor(random()*array_length(nz,1))::int] || '-'
      || lpad(floor(random()*100)::text, 2, '0');
END; $$;

-- Ensure a token row exists for (challenge, date); returns the text.
CREATE OR REPLACE FUNCTION ensure_daily_token(p_challenge_id UUID, p_date DATE)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_text TEXT;
BEGIN
  SELECT token_text INTO v_text FROM daily_tokens WHERE challenge_id = p_challenge_id AND token_date = p_date;
  IF v_text IS NULL THEN
    v_text := gen_token_text();
    INSERT INTO daily_tokens (challenge_id, token_date, token_text)
    VALUES (p_challenge_id, p_date, v_text)
    ON CONFLICT (challenge_id, token_date) DO UPDATE SET token_text = daily_tokens.token_text
    RETURNING token_text INTO v_text;
  END IF;
  RETURN v_text;
END; $$;

-- Cron: pre-generate today's + tomorrow's tokens for every live challenge.
CREATE OR REPLACE FUNCTION rotate_daily_tokens()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count INT := 0; r RECORD;
BEGIN
  FOR r IN SELECT id FROM challenges WHERE status = 'live' LOOP
    PERFORM ensure_daily_token(r.id, CURRENT_DATE);
    PERFORM ensure_daily_token(r.id, CURRENT_DATE + 1);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END; $$;


-- ─── Group assignment (idempotent) ───────────────────────────────────────────
-- Partition active participants into groups sized between group_size_min/max,
-- round-robin for balance. Called when a challenge goes live.
CREATE OR REPLACE FUNCTION assign_groups(p_challenge_id UUID)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_n INT; v_max INT; v_groups INT; r RECORD; v_idx INT; v_group_ids UUID[];
BEGIN
  IF EXISTS (SELECT 1 FROM accountability_groups WHERE challenge_id = p_challenge_id) THEN
    RETURN 0;  -- already assigned
  END IF;

  SELECT COUNT(*) INTO v_n FROM challenge_participants WHERE challenge_id = p_challenge_id AND status = 'active';
  IF v_n = 0 THEN RETURN 0; END IF;

  SELECT group_size_max INTO v_max FROM challenges WHERE id = p_challenge_id;
  v_groups := GREATEST(1, CEIL(v_n::numeric / v_max)::int);

  -- create the groups, collect their ids in order
  v_group_ids := ARRAY[]::UUID[];
  FOR v_idx IN 1..v_groups LOOP
    INSERT INTO accountability_groups (challenge_id, group_index)
    VALUES (p_challenge_id, v_idx)
    RETURNING id INTO r;
    v_group_ids := array_append(v_group_ids, r.id);
  END LOOP;

  -- round-robin assign participants
  v_idx := 0;
  FOR r IN
    SELECT user_id FROM challenge_participants
    WHERE challenge_id = p_challenge_id AND status = 'active'
    ORDER BY joined_at
  LOOP
    INSERT INTO group_members (group_id, challenge_id, user_id)
    VALUES (v_group_ids[1 + (v_idx % v_groups)], p_challenge_id, r.user_id)
    ON CONFLICT (challenge_id, user_id) DO NOTHING;
    v_idx := v_idx + 1;
  END LOOP;

  RETURN v_groups;
END; $$;


-- ─── Create / replace a daily submission (user) ──────────────────────────────
-- The client records in-app, uploads to the 'proofs' bucket, then calls this to
-- register the row. Re-recording before ML runs replaces the pending row.
CREATE OR REPLACE FUNCTION create_submission(
  p_challenge_id UUID, p_video_path TEXT, p_video_seconds NUMERIC DEFAULT NULL, p_proof_date DATE DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
  v_status TEXT; v_target INT; v_group UUID; v_token UUID; v_sub UUID; v_existing TEXT;
  v_date DATE := COALESCE(p_proof_date, CURRENT_DATE);  -- server-authoritative day
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated.'; END IF;

  SELECT status, target_reps INTO v_status, v_target FROM challenges WHERE id = p_challenge_id;
  IF v_status <> 'live' THEN RAISE EXCEPTION 'Challenge is not accepting proof right now.'; END IF;

  IF NOT EXISTS (SELECT 1 FROM challenge_participants WHERE challenge_id = p_challenge_id AND user_id = v_user AND status = 'active') THEN
    RAISE EXCEPTION 'You are not an active participant in this challenge.';
  END IF;

  IF p_proof_date IS NOT NULL AND p_proof_date <> CURRENT_DATE THEN
    RAISE EXCEPTION 'Proof can only be submitted for today.';
  END IF;

  -- token must exist for today (anti-replay); create lazily if missing
  PERFORM ensure_daily_token(p_challenge_id, v_date);
  SELECT id INTO v_token FROM daily_tokens WHERE challenge_id = p_challenge_id AND token_date = v_date;

  SELECT group_id INTO v_group FROM group_members WHERE challenge_id = p_challenge_id AND user_id = v_user;

  -- guard against overwriting an already-decided submission
  SELECT status::text INTO v_existing FROM submissions WHERE challenge_id = p_challenge_id AND user_id = v_user AND proof_date = v_date;
  IF v_existing IS NOT NULL AND v_existing NOT IN ('pending_ml','missed','expired') THEN
    RAISE EXCEPTION 'Today''s proof is already % and cannot be replaced.', v_existing;
  END IF;

  INSERT INTO submissions (challenge_id, user_id, group_id, proof_date, token_id, video_path, video_seconds, status, ml_target)
  VALUES (p_challenge_id, v_user, v_group, v_date, v_token, p_video_path, p_video_seconds, 'pending_ml', v_target)
  ON CONFLICT (challenge_id, user_id, proof_date) DO UPDATE
    SET video_path = EXCLUDED.video_path, video_seconds = EXCLUDED.video_seconds,
        status = 'pending_ml', token_id = EXCLUDED.token_id, ml_target = EXCLUDED.ml_target,
        ml_rep_count = NULL, ml_suspicion = NULL, ml_signals = NULL, token_detected = NULL, ml_checked_at = NULL
  RETURNING id INTO v_sub;

  RETURN v_sub;
END; $$;


-- ─── Neutral reviewer assignment (service / internal) ────────────────────────
-- Picks reviewers with NO stake in this pot: paid reviewers first, else players
-- from a DIFFERENT challenge. Never the owner, never anyone in this challenge.
CREATE OR REPLACE FUNCTION assign_reviewers(p_submission_id UUID, p_count INT DEFAULT NULL)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_challenge UUID; v_owner UUID; v_need INT; v_added INT := 0; r RECORD;
BEGIN
  SELECT challenge_id, user_id INTO v_challenge, v_owner FROM submissions WHERE id = p_submission_id;
  IF v_challenge IS NULL THEN RETURN 0; END IF;

  SELECT COALESCE(p_count, review_quorum) INTO v_need FROM challenges WHERE id = v_challenge;
  v_need := v_need - (SELECT COUNT(*) FROM reviewer_assignments WHERE submission_id = p_submission_id AND status IN ('assigned','completed'));
  IF v_need <= 0 THEN RETURN 0; END IF;

  -- 1) paid reviewers (not in this challenge, not already assigned)
  FOR r IN
    SELECT p.id AS uid
    FROM profiles p
    WHERE p.is_reviewer = TRUE
      AND p.id <> v_owner
      AND NOT EXISTS (SELECT 1 FROM challenge_participants cp WHERE cp.challenge_id = v_challenge AND cp.user_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM reviewer_assignments ra WHERE ra.submission_id = p_submission_id AND ra.reviewer_id = p.id)
    ORDER BY random()
    LIMIT v_need
  LOOP
    INSERT INTO reviewer_assignments (submission_id, reviewer_id, kind, due_at)
    VALUES (p_submission_id, r.uid, 'paid', NOW() + INTERVAL '48 hours')
    ON CONFLICT DO NOTHING;
    v_added := v_added + 1;
  END LOOP;

  -- 2) cross-challenge neutral players to fill the rest
  v_need := v_need - v_added;
  IF v_need > 0 THEN
    FOR r IN
      SELECT DISTINCT gm.user_id AS uid
      FROM group_members gm
      WHERE gm.challenge_id <> v_challenge
        AND gm.user_id <> v_owner
        AND NOT EXISTS (SELECT 1 FROM challenge_participants cp WHERE cp.challenge_id = v_challenge AND cp.user_id = gm.user_id)
        AND NOT EXISTS (SELECT 1 FROM reviewer_assignments ra WHERE ra.submission_id = p_submission_id AND ra.reviewer_id = gm.user_id)
      ORDER BY random()
      LIMIT v_need
    LOOP
      INSERT INTO reviewer_assignments (submission_id, reviewer_id, kind, due_at)
      VALUES (p_submission_id, r.uid, 'cross_challenge', NOW() + INTERVAL '48 hours')
      ON CONFLICT DO NOTHING;
      v_added := v_added + 1;
    END LOOP;
  END IF;

  RETURN v_added;  -- may be < quorum if the pool is thin; cron retries
END; $$;


-- ─── ML quick-pass ingestion (service role; called by edge function) ─────────
CREATE OR REPLACE FUNCTION ingest_ml_result(
  p_submission_id UUID, p_rep_count INT, p_suspicion NUMERIC, p_signals JSONB, p_token_detected BOOLEAN
) RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_challenge UUID; v_threshold NUMERIC; v_target INT; v_flag_pressure NUMERIC; v_status submission_status;
BEGIN
  SELECT challenge_id, ml_target INTO v_challenge, v_target FROM submissions WHERE id = p_submission_id;
  IF v_challenge IS NULL THEN RAISE EXCEPTION 'Submission not found.'; END IF;
  SELECT ml_auto_threshold INTO v_threshold FROM challenges WHERE id = v_challenge;

  UPDATE submissions
  SET ml_rep_count = p_rep_count, ml_suspicion = p_suspicion, ml_signals = p_signals,
      token_detected = p_token_detected, ml_checked_at = NOW()
  WHERE id = p_submission_id;

  SELECT COALESCE(SUM(weight),0) INTO v_flag_pressure FROM submission_flags WHERE submission_id = p_submission_id;

  IF p_suspicion < v_threshold
     AND COALESCE(p_token_detected, FALSE)
     AND (v_target IS NULL OR p_rep_count >= v_target)
     AND v_flag_pressure < (SELECT flag_pressure_threshold FROM challenges WHERE id = v_challenge)
  THEN
    v_status := 'auto_approved';
    UPDATE submissions SET status = v_status WHERE id = p_submission_id;
  ELSE
    v_status := 'in_review';
    UPDATE submissions SET status = v_status WHERE id = p_submission_id;
    PERFORM assign_reviewers(p_submission_id);
  END IF;

  RETURN v_status::text;
END; $$;


-- ─── Submit a flag (user; one-tap, structured) ───────────────────────────────
CREATE OR REPLACE FUNCTION submit_flag(p_submission_id UUID, p_reason flag_reason, p_note TEXT DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
  v_owner UUID; v_status submission_status; v_challenge UUID; v_weight NUMERIC; v_pressure NUMERIC; v_threshold NUMERIC;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated.'; END IF;

  SELECT user_id, status, challenge_id INTO v_owner, v_status, v_challenge FROM submissions WHERE id = p_submission_id;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Submission not found.'; END IF;
  IF v_owner = v_user THEN RAISE EXCEPTION 'You cannot flag your own submission.'; END IF;
  IF v_status NOT IN ('pending_ml','auto_approved','in_review') THEN
    RAISE EXCEPTION 'This submission is already resolved.';
  END IF;
  IF NOT is_group_peer(p_submission_id) THEN
    RAISE EXCEPTION 'Only members of the same accountability group can flag this.';
  END IF;

  -- ensure reputation row, read weight snapshot
  INSERT INTO flagger_reputation (user_id) VALUES (v_user) ON CONFLICT (user_id) DO NOTHING;
  SELECT weight INTO v_weight FROM flagger_reputation WHERE user_id = v_user;

  INSERT INTO submission_flags (submission_id, flagger_id, reason, note, weight)
  VALUES (p_submission_id, v_user, p_reason, p_note, v_weight)
  ON CONFLICT (submission_id, flagger_id) DO NOTHING;

  UPDATE flagger_reputation SET flags_total = flags_total + 1, updated_at = NOW() WHERE user_id = v_user;

  -- escalate to review if weighted pressure crosses the threshold
  SELECT COALESCE(SUM(weight),0) INTO v_pressure FROM submission_flags WHERE submission_id = p_submission_id;
  SELECT flag_pressure_threshold INTO v_threshold FROM challenges WHERE id = v_challenge;

  IF v_status <> 'in_review' AND v_pressure >= v_threshold THEN
    UPDATE submissions SET status = 'in_review' WHERE id = p_submission_id;
    PERFORM assign_reviewers(p_submission_id);
  END IF;
END; $$;


-- ─── Submit a review decision (assigned neutral reviewer) ─────────────────────
CREATE OR REPLACE FUNCTION submit_review(p_submission_id UUID, p_decision review_decision, p_reason TEXT DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
  v_kind reviewer_kind; v_challenge UUID; v_quorum INT; v_done INT; v_approve INT; v_reject INT;
  v_final review_decision; r RECORD;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated.'; END IF;

  SELECT kind INTO v_kind FROM reviewer_assignments
  WHERE submission_id = p_submission_id AND reviewer_id = v_user AND status = 'assigned';
  IF v_kind IS NULL THEN RAISE EXCEPTION 'You are not an active reviewer for this submission.'; END IF;

  INSERT INTO reviews (submission_id, reviewer_id, kind, decision, reason)
  VALUES (p_submission_id, v_user, v_kind, p_decision, p_reason)
  ON CONFLICT (submission_id, reviewer_id) DO NOTHING;

  UPDATE reviewer_assignments SET status = 'completed'
  WHERE submission_id = p_submission_id AND reviewer_id = v_user;

  SELECT challenge_id INTO v_challenge FROM submissions WHERE id = p_submission_id;
  SELECT review_quorum INTO v_quorum FROM challenges WHERE id = v_challenge;

  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE decision = 'approved'),
         COUNT(*) FILTER (WHERE decision = 'rejected')
    INTO v_done, v_approve, v_reject
  FROM reviews WHERE submission_id = p_submission_id;

  IF v_done < v_quorum THEN
    RETURN 'pending';  -- need more reviewers
  END IF;

  -- ⚖️ LEGAL: tie-break policy (benefit of the doubt → approved) decides whether a
  --     player keeps or forfeits their stake. Confirm fairness/ToS framing.
  v_final := CASE WHEN v_reject > v_approve THEN 'rejected'::review_decision ELSE 'approved'::review_decision END;

  UPDATE submissions
  SET status = (CASE WHEN v_final = 'approved' THEN 'approved' ELSE 'rejected' END)::submission_status,
      decided_at = NOW(), decided_reason = COALESCE(p_reason, v_final::text)
  WHERE id = p_submission_id;

  -- resolve flags: upheld if the submission was rejected
  UPDATE submission_flags SET upheld = (v_final = 'rejected') WHERE submission_id = p_submission_id;

  -- update each flagger's reputation (Laplace-smoothed precision as weight)
  FOR r IN SELECT flagger_id, upheld FROM submission_flags WHERE submission_id = p_submission_id LOOP
    INSERT INTO flagger_reputation (user_id) VALUES (r.flagger_id) ON CONFLICT (user_id) DO NOTHING;
    UPDATE flagger_reputation
      SET flags_upheld     = flags_upheld     + (CASE WHEN r.upheld THEN 1 ELSE 0 END),
          flags_overturned = flags_overturned + (CASE WHEN r.upheld THEN 0 ELSE 1 END),
          weight = GREATEST(0.1, LEAST(1.0,
                    (flags_upheld + (CASE WHEN r.upheld THEN 1 ELSE 0 END) + 1.0)
                  / (flags_total + 1.0))),
          updated_at = NOW()
    WHERE user_id = r.flagger_id;
  END LOOP;

  RETURN v_final::text;
END; $$;


-- ─── Success determination (used by payout in Phase 4) ───────────────────────
CREATE OR REPLACE FUNCTION required_success_count(p_challenge_id UUID)
RETURNS INT LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN cadence = 'once' THEN 1
              ELSE COALESCE(required_count, duration_days) END
  FROM challenges WHERE id = p_challenge_id;
$$;

CREATE OR REPLACE FUNCTION count_approved_submissions(p_challenge_id UUID, p_user_id UUID)
RETURNS INT LANGUAGE sql STABLE AS $$
  SELECT COUNT(*)::int FROM submissions
  WHERE challenge_id = p_challenge_id AND user_id = p_user_id
    AND status IN ('approved','auto_approved');
$$;

-- TRUE if the participant has met the bar (approved days ≥ required − allowed_misses).
CREATE OR REPLACE FUNCTION participant_succeeded(p_challenge_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT count_approved_submissions(p_challenge_id, p_user_id)
         >= GREATEST(1, required_success_count(p_challenge_id)
                        - (SELECT allowed_misses FROM challenges WHERE id = p_challenge_id));
$$;


-- ─── Storage bucket for in-app-recorded proof video ──────────────────────────
INSERT INTO storage.buckets (id, name, public) VALUES ('proofs','proofs', false)
ON CONFLICT (id) DO NOTHING;

-- Path convention: {challenge_id}/{user_id}/{proof_date}.mp4
-- Owner gets INSERT+SELECT+UPDATE (upsert needs all three). Group peers and
-- reviewers do NOT get direct storage access — they receive short-lived signed
-- URLs minted server-side after an RLS check (see get-proof-url edge function).
DROP POLICY IF EXISTS proofs_insert_own ON storage.objects;
CREATE POLICY proofs_insert_own ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'proofs' AND (storage.foldername(name))[2] = auth.uid()::text);

DROP POLICY IF EXISTS proofs_select_own ON storage.objects;
CREATE POLICY proofs_select_own ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'proofs' AND (storage.foldername(name))[2] = auth.uid()::text);

DROP POLICY IF EXISTS proofs_update_own ON storage.objects;
CREATE POLICY proofs_update_own ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'proofs' AND (storage.foldername(name))[2] = auth.uid()::text)
  WITH CHECK (bucket_id = 'proofs' AND (storage.foldername(name))[2] = auth.uid()::text);


-- ─── Grants: lock service-only RPCs, keep user RPCs callable ──────────────────
REVOKE EXECUTE ON FUNCTION post_ledger(UUID, UUID, ledger_entry_type, NUMERIC, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION ensure_daily_token(UUID, DATE)        FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION rotate_daily_tokens()                 FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION assign_groups(UUID)                   FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION assign_reviewers(UUID, INT)           FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION ingest_ml_result(UUID, INT, NUMERIC, JSONB, BOOLEAN) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION post_ledger(UUID, UUID, ledger_entry_type, NUMERIC, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION ensure_daily_token(UUID, DATE)         TO service_role;
GRANT EXECUTE ON FUNCTION rotate_daily_tokens()                  TO service_role;
GRANT EXECUTE ON FUNCTION assign_groups(UUID)                    TO service_role;
GRANT EXECUTE ON FUNCTION assign_reviewers(UUID, INT)            TO service_role;
GRANT EXECUTE ON FUNCTION ingest_ml_result(UUID, INT, NUMERIC, JSONB, BOOLEAN) TO service_role;

-- user-callable funnel RPCs (they enforce auth.uid() internally)
GRANT EXECUTE ON FUNCTION create_submission(UUID, TEXT, NUMERIC, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION submit_flag(UUID, flag_reason, TEXT)         TO authenticated;
GRANT EXECUTE ON FUNCTION submit_review(UUID, review_decision, TEXT)   TO authenticated;
