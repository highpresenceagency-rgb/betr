-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICATION FUNNEL — schema module
-- ════════════════════════════════════════════════════════════════════════════
-- Layers on top of schema.sql. Adds daily video-proof submissions, an ML
-- quick-pass, accountability groups with one-tap flagging, neutral binding
-- review, flagger reputation, daily anti-replay tokens, and a points ledger.
--
-- Design rules baked in here:
--   • All WRITES go through SECURITY DEFINER RPCs (like join_challenge) so we can
--     enforce cross-table rules (same-group, not-self, neutral-reviewer). RLS on
--     the tables themselves is read-shaped.
--   • A "neutral" reviewer has NO stake in the pot they're judging. Because
--     winners split losers' forfeited stake, a same-challenge player has a
--     perverse incentive to fail others. So reviewers are 'paid' or
--     'cross_challenge' (a player from a *different* challenge). Never same-group.
--   • Re-runnable: CREATE TABLE IF NOT EXISTS + DROP POLICY IF EXISTS.
--
-- ⚖️  LEGAL: every money/odds/payout touchpoint is tagged `-- ⚖️ LEGAL` for a
--     lawyer's pre-launch review. This file does not attempt to resolve them.
-- ════════════════════════════════════════════════════════════════════════════


-- ─── Enums ────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE submission_status AS ENUM
    ('pending_ml','auto_approved','in_review','approved','rejected','expired','missed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE flag_reason AS ENUM
    ('sped_up','cant_see_full_reps','possibly_reused','not_same_person','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE review_decision AS ENUM ('approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE reviewer_kind AS ENUM ('paid','cross_challenge');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE assignment_status AS ENUM ('assigned','completed','expired','recused');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ledger_entry_type AS ENUM
    ('deposit','stake_lock','stake_forfeit','stake_release','winnings',
     'creator_fee','reviewer_fee','cashout','refund','adjustment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ─── Challenge config for verification (additive columns) ─────────────────────
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS cadence            TEXT    NOT NULL DEFAULT 'daily' CHECK (cadence IN ('daily','once'));
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS proof_type         TEXT    NOT NULL DEFAULT 'video' CHECK (proof_type IN ('video'));
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS target_reps        INT     CHECK (target_reps IS NULL OR target_reps > 0);          -- reps required per submission, e.g. 100
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS required_count     INT     CHECK (required_count IS NULL OR required_count > 0);    -- how many successful days needed; NULL ⇒ derive from duration_days
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS allowed_misses     INT     NOT NULL DEFAULT 0 CHECK (allowed_misses >= 0);
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS ml_auto_threshold  NUMERIC(3,2) NOT NULL DEFAULT 0.30 CHECK (ml_auto_threshold BETWEEN 0 AND 1); -- suspicion < this ⇒ eligible for auto-approve
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS flag_pressure_threshold NUMERIC NOT NULL DEFAULT 1.0 CHECK (flag_pressure_threshold > 0);       -- weighted flag sum that forces review
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS review_quorum      INT     NOT NULL DEFAULT 1 CHECK (review_quorum >= 1);            -- neutral decisions needed to bind
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS group_size_min     INT     NOT NULL DEFAULT 4  CHECK (group_size_min >= 2);
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS group_size_max     INT     NOT NULL DEFAULT 10 CHECK (group_size_max >= group_size_min);


-- ─── Accountability groups ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS accountability_groups (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID REFERENCES challenges ON DELETE CASCADE NOT NULL,
  group_index  INT NOT NULL,                       -- 1-based ordinal within the challenge
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (challenge_id, group_index)
);

CREATE TABLE IF NOT EXISTS group_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     UUID REFERENCES accountability_groups ON DELETE CASCADE NOT NULL,
  challenge_id UUID REFERENCES challenges ON DELETE CASCADE NOT NULL,   -- denormalized for RLS
  user_id      UUID REFERENCES auth.users NOT NULL,
  joined_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (challenge_id, user_id)                    -- exactly one group per challenge
);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user  ON group_members(user_id);


-- ─── Daily anti-replay tokens ─────────────────────────────────────────────────
-- A short spoken/shown phrase the user must present at the START of the video.
-- Per (challenge, day) so a clip can't be reused across days or challenges.
-- Only revealed to participants on/after its day (see RLS) so it can't be
-- pre-recorded.
CREATE TABLE IF NOT EXISTS daily_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID REFERENCES challenges ON DELETE CASCADE NOT NULL,
  token_date   DATE NOT NULL,
  token_text   TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (challenge_id, token_date)
);


-- ─── Submissions (the daily proof) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS submissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id  UUID REFERENCES challenges ON DELETE CASCADE NOT NULL,
  user_id       UUID REFERENCES auth.users NOT NULL,
  group_id      UUID REFERENCES accountability_groups ON DELETE SET NULL,
  proof_date    DATE NOT NULL,                      -- the day this submission counts toward
  token_id      UUID REFERENCES daily_tokens,
  video_path    TEXT,                               -- path in the 'proofs' storage bucket
  video_seconds NUMERIC,
  status        submission_status NOT NULL DEFAULT 'pending_ml',

  -- ML quick-pass outputs
  ml_rep_count  INT,
  ml_target     INT,                                -- target_reps snapshot at submit time
  ml_suspicion  NUMERIC(3,2) CHECK (ml_suspicion IS NULL OR ml_suspicion BETWEEN 0 AND 1),
  ml_signals    JSONB,                              -- {sped_up, looped, token_missing, person_mismatch, ...}
  token_detected BOOLEAN,
  ml_checked_at TIMESTAMPTZ,

  -- resolution
  decided_at    TIMESTAMPTZ,
  decided_reason TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (challenge_id, user_id, proof_date)        -- one counted submission per day
);
CREATE INDEX IF NOT EXISTS idx_submissions_challenge ON submissions(challenge_id);
CREATE INDEX IF NOT EXISTS idx_submissions_user      ON submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_group     ON submissions(group_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status    ON submissions(status);


-- ─── Flags (one-tap, structured, weighted by flagger reputation) ──────────────
CREATE TABLE IF NOT EXISTS submission_flags (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES submissions ON DELETE CASCADE NOT NULL,
  flagger_id    UUID REFERENCES auth.users NOT NULL,
  reason        flag_reason NOT NULL,
  note          TEXT,
  weight        NUMERIC NOT NULL DEFAULT 1.0,       -- snapshot of flagger reputation at flag time
  upheld        BOOLEAN,                            -- set when the review resolves: TRUE if reject, FALSE if approve
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (submission_id, flagger_id)                -- one flag per user per submission
);
CREATE INDEX IF NOT EXISTS idx_flags_submission ON submission_flags(submission_id);
CREATE INDEX IF NOT EXISTS idx_flags_flagger    ON submission_flags(flagger_id);


-- ─── Neutral reviewer assignments + decisions ─────────────────────────────────
CREATE TABLE IF NOT EXISTS reviewer_assignments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES submissions ON DELETE CASCADE NOT NULL,
  reviewer_id   UUID REFERENCES auth.users NOT NULL,
  kind          reviewer_kind NOT NULL,
  status        assignment_status NOT NULL DEFAULT 'assigned',
  assigned_at   TIMESTAMPTZ DEFAULT NOW(),
  due_at        TIMESTAMPTZ,
  UNIQUE (submission_id, reviewer_id)
);
CREATE INDEX IF NOT EXISTS idx_assign_reviewer ON reviewer_assignments(reviewer_id, status);

CREATE TABLE IF NOT EXISTS reviews (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES submissions ON DELETE CASCADE NOT NULL,
  reviewer_id   UUID REFERENCES auth.users NOT NULL,
  kind          reviewer_kind NOT NULL,
  decision      review_decision NOT NULL,
  reason        TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (submission_id, reviewer_id)
);
CREATE INDEX IF NOT EXISTS idx_reviews_submission ON reviews(submission_id);


-- ─── Flagger reputation (anti-abuse: downweight chronically-wrong flaggers) ────
CREATE TABLE IF NOT EXISTS flagger_reputation (
  user_id          UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  flags_total      INT NOT NULL DEFAULT 0,
  flags_upheld     INT NOT NULL DEFAULT 0,
  flags_overturned INT NOT NULL DEFAULT 0,
  weight           NUMERIC NOT NULL DEFAULT 1.0 CHECK (weight BETWEEN 0 AND 1),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);


-- ─── Points ledger (append-only source of truth for point movements) ──────────
-- ⚖️ LEGAL: the points ledger and its USD conversion at cashout is the financial
--     spine of the betting mechanic. Treatment of stakes, forfeits, and payouts
--     needs counsel review (money transmission, gambling, escrow, tax 1099-K).
CREATE TABLE IF NOT EXISTS points_ledger (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      UUID REFERENCES auth.users NOT NULL,
  challenge_id UUID REFERENCES challenges ON DELETE SET NULL,
  entry_type   ledger_entry_type NOT NULL,
  amount       NUMERIC(12,2) NOT NULL,              -- signed: +credit / -debit, in points
  ref          TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ledger_user      ON points_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_challenge ON points_ledger(challenge_id);


-- ════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE accountability_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members         ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_tokens          ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_flags      ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviewer_assignments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews               ENABLE ROW LEVEL SECURITY;
ALTER TABLE flagger_reputation    ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_ledger         ENABLE ROW LEVEL SECURITY;

-- helper: is the current user in the same group as a given submission?
CREATE OR REPLACE FUNCTION is_group_peer(p_submission_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM submissions s
    JOIN group_members gm ON gm.group_id = s.group_id
    WHERE s.id = p_submission_id
      AND gm.user_id = auth.uid()
  );
$$;

-- helper: is the current user an assigned reviewer for a given submission?
CREATE OR REPLACE FUNCTION is_reviewer_for(p_submission_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM reviewer_assignments ra
    WHERE ra.submission_id = p_submission_id
      AND ra.reviewer_id = auth.uid()
  );
$$;

-- groups: visible to members of the challenge (and public-challenge viewers)
DROP POLICY IF EXISTS groups_select ON accountability_groups;
CREATE POLICY groups_select ON accountability_groups FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM group_members gm WHERE gm.challenge_id = accountability_groups.challenge_id AND gm.user_id = auth.uid())
);

DROP POLICY IF EXISTS group_members_select ON group_members;
CREATE POLICY group_members_select ON group_members FOR SELECT TO authenticated USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM group_members me WHERE me.group_id = group_members.group_id AND me.user_id = auth.uid())
);

-- daily tokens: a participant may read their challenge's token only on/after its
-- day (never future days ⇒ can't pre-record). Service role manages writes.
DROP POLICY IF EXISTS daily_tokens_select ON daily_tokens;
CREATE POLICY daily_tokens_select ON daily_tokens FOR SELECT TO authenticated USING (
  token_date <= CURRENT_DATE
  AND EXISTS (
    SELECT 1 FROM challenge_participants cp
    WHERE cp.challenge_id = daily_tokens.challenge_id AND cp.user_id = auth.uid()
  )
);

-- submissions: owner, same-group peers (to flag), and assigned reviewers may read.
DROP POLICY IF EXISTS submissions_select ON submissions;
CREATE POLICY submissions_select ON submissions FOR SELECT TO authenticated USING (
  user_id = auth.uid()
  OR is_group_peer(id)
  OR is_reviewer_for(id)
);
-- Direct INSERT/UPDATE by users is blocked; submissions are created/updated via
-- RPCs (create_submission, ingest_ml_result, submit_review). No write policy ⇒ denied.

-- flags: readable by the flagger, the submission owner, group peers, and reviewers.
DROP POLICY IF EXISTS flags_select ON submission_flags;
CREATE POLICY flags_select ON submission_flags FOR SELECT TO authenticated USING (
  flagger_id = auth.uid()
  OR is_group_peer(submission_id)
  OR is_reviewer_for(submission_id)
);
-- Writes via submit_flag() RPC only.

-- reviewer assignments / reviews: a reviewer sees their own.
DROP POLICY IF EXISTS assignments_select ON reviewer_assignments;
CREATE POLICY assignments_select ON reviewer_assignments FOR SELECT TO authenticated USING (reviewer_id = auth.uid());

DROP POLICY IF EXISTS reviews_select ON reviews;
CREATE POLICY reviews_select ON reviews FOR SELECT TO authenticated USING (
  reviewer_id = auth.uid() OR is_group_peer(submission_id)
);
-- Writes via submit_review() RPC only.

-- flagger reputation: a user can read their own.
DROP POLICY IF EXISTS reputation_own ON flagger_reputation;
CREATE POLICY reputation_own ON flagger_reputation FOR SELECT TO authenticated USING (user_id = auth.uid());

-- points ledger: own rows only, read-only (writes via service-role RPC).
DROP POLICY IF EXISTS ledger_own ON points_ledger;
CREATE POLICY ledger_own ON points_ledger FOR SELECT TO authenticated USING (user_id = auth.uid());


-- ════════════════════════════════════════════════════════════════════════════
-- (Phase 2 RPCs — token rotation, group assignment, submit_flag/review,
--  reviewer assignment, success determination — are added in verification_logic.sql)
-- ════════════════════════════════════════════════════════════════════════════
