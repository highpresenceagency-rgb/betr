-- ════════════════════════════════════════════════════════════════════════════
-- BETTRR — full database setup. Paste into Supabase SQL Editor and Run.
-- Order: schema, verification, verification_logic, settlement, security, performance.
-- Re-runnable. (The live project yk... was set up via MCP migrations 01-07.)
-- ════════════════════════════════════════════════════════════════════════════


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  schema.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ─── Tables ──────────────────────────────────────────────────────────────────

CREATE TABLE profiles (
  id            UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL DEFAULT '',
  initials      TEXT NOT NULL DEFAULT '',
  stripe_customer_id TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE wallets (
  user_id       UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  balance       NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  locked_balance NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (locked_balance >= 0),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE challenges (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id           UUID REFERENCES auth.users NOT NULL,
  goal                 TEXT NOT NULL,
  type                 TEXT NOT NULL CHECK (type IN ('public', 'private')),
  bet_amount           NUMERIC(10,2) NOT NULL CHECK (bet_amount > 0),
  duration_days        INT NOT NULL CHECK (duration_days > 0),
  starts_at            TIMESTAMPTZ NOT NULL,
  ends_at              TIMESTAMPTZ,
  status               TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'live', 'voting', 'completed', 'cancelled')),
  creator_fee_percent  INT NOT NULL DEFAULT 0 CHECK (creator_fee_percent BETWEEN 0 AND 10),
  creator_participates BOOLEAN NOT NULL DEFAULT TRUE,
  participant_count    INT NOT NULL DEFAULT 0,
  pot                  NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE challenge_participants (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID REFERENCES challenges ON DELETE CASCADE NOT NULL,
  user_id      UUID REFERENCES auth.users NOT NULL,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'won', 'eliminated')),
  joined_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(challenge_id, user_id)
);

CREATE TABLE votes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID REFERENCES challenges NOT NULL,
  voter_id     UUID REFERENCES auth.users NOT NULL,
  target_id    UUID REFERENCES auth.users NOT NULL,
  passed       BOOLEAN NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(challenge_id, voter_id, target_id),
  CHECK (voter_id != target_id)
);

CREATE TABLE friendships (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID REFERENCES auth.users NOT NULL,
  addressee_id UUID REFERENCES auth.users NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(requester_id, addressee_id)
);

CREATE TABLE transactions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES auth.users NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'challenge_join', 'win', 'refund')),
  amount       NUMERIC(10,2) NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE withdrawal_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES auth.users NOT NULL,
  amount       NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Auto-create profile + wallet on sign up ──────────────────────────────────

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, username, name, initials)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 6)),
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'initials', '')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO wallets (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── Atomic join challenge (check balance, lock funds, add participant) ────────

CREATE OR REPLACE FUNCTION join_challenge(p_challenge_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_bet     NUMERIC;
  v_bal     NUMERIC;
  v_goal    TEXT;
  v_status  TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  SELECT bet_amount, goal, status INTO v_bet, v_goal, v_status FROM challenges WHERE id = p_challenge_id;

  IF v_status NOT IN ('pending', 'live') THEN
    RAISE EXCEPTION 'Challenge is not open for joining.';
  END IF;

  SELECT balance INTO v_bal FROM wallets WHERE user_id = v_user_id;

  IF v_bal < v_bet THEN
    RAISE EXCEPTION 'Insufficient balance. Add $% to your wallet first.', v_bet;
  END IF;

  -- Lock funds
  UPDATE wallets
  SET balance = balance - v_bet, locked_balance = locked_balance + v_bet, updated_at = NOW()
  WHERE user_id = v_user_id;

  -- Add participant
  INSERT INTO challenge_participants (challenge_id, user_id) VALUES (p_challenge_id, v_user_id);

  -- Update challenge totals
  UPDATE challenges
  SET participant_count = participant_count + 1, pot = pot + v_bet
  WHERE id = p_challenge_id;

  -- Record transaction
  INSERT INTO transactions (user_id, type, amount, description)
  VALUES (v_user_id, 'challenge_join', v_bet, 'Joined: ' || v_goal);
END;
$$;

-- ─── Wallet increment (used by process-payout) ────────────────────────────────

CREATE OR REPLACE FUNCTION increment_wallet(user_id UUID, amount NUMERIC)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE wallets w
  SET balance = w.balance + amount,
      updated_at = NOW()
  WHERE w.user_id = increment_wallet.user_id;
END;
$$;

-- ─── Forfeit locked funds (called for challenge losers) ───────────────────────

CREATE OR REPLACE FUNCTION forfeit_locked(p_user_id UUID, p_amount NUMERIC)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE wallets
  SET locked_balance = GREATEST(0, locked_balance - p_amount), updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$;

-- ─── Release locked funds back to balance (refunds) ──────────────────────────

CREATE OR REPLACE FUNCTION release_locked(p_user_id UUID, p_amount NUMERIC)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE wallets
  SET balance = balance + p_amount,
      locked_balance = GREATEST(0, locked_balance - p_amount),
      updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$;

-- ─── Request withdrawal (deducts balance, creates request record) ─────────────

CREATE OR REPLACE FUNCTION request_withdrawal(p_user_id UUID, p_amount NUMERIC)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_bal NUMERIC;
  v_req_id UUID;
BEGIN
  SELECT balance INTO v_bal FROM wallets WHERE user_id = p_user_id;

  IF v_bal < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance.';
  END IF;

  UPDATE wallets SET balance = balance - p_amount, updated_at = NOW() WHERE user_id = p_user_id;

  INSERT INTO withdrawal_requests (user_id, amount) VALUES (p_user_id, p_amount) RETURNING id INTO v_req_id;

  INSERT INTO transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'withdrawal', p_amount, 'Withdrawal request — pending processing');

  RETURN v_req_id;
END;
$$;

-- ─── Transition challenge statuses (called by cron) ──────────────────────────

CREATE OR REPLACE FUNCTION transition_challenge_statuses()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- pending → live when starts_at has passed
  UPDATE challenges SET status = 'live'
  WHERE status = 'pending' AND starts_at <= NOW();

  -- live → voting when ends_at has passed
  UPDATE challenges SET status = 'voting'
  WHERE status = 'live' AND ends_at IS NOT NULL AND ends_at <= NOW();
END;
$$;

-- ─── Profile stats ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_profile_stats(p_user_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_won       NUMERIC;
  v_wins      INT;
  v_losses    INT;
  v_completed INT;
  v_streak    INT := 0;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_won
  FROM transactions WHERE user_id = p_user_id AND type = 'win';

  SELECT
    COUNT(*) FILTER (WHERE status = 'won'),
    COUNT(*) FILTER (WHERE status = 'eliminated')
  INTO v_wins, v_losses
  FROM challenge_participants WHERE user_id = p_user_id;

  v_completed := v_wins + v_losses;

  -- Streak: consecutive wins from most recent challenge, stopping at first loss
  WITH ranked AS (
    SELECT status, ROW_NUMBER() OVER (ORDER BY joined_at DESC) AS rn
    FROM challenge_participants
    WHERE user_id = p_user_id AND status IN ('won', 'eliminated')
    LIMIT 50
  ),
  first_loss AS (
    SELECT COALESCE(MIN(rn), 9999) AS rn FROM ranked WHERE status = 'eliminated'
  )
  SELECT COUNT(*) INTO v_streak
  FROM ranked r, first_loss fl
  WHERE r.status = 'won' AND r.rn < fl.rn;

  RETURN json_build_object(
    'won',       v_won,
    'win_rate',  CASE WHEN v_completed > 0 THEN ROUND(v_wins::NUMERIC / v_completed * 100) ELSE 0 END,
    'completed', v_completed,
    'streak',    v_streak
  );
END;
$$;

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets               ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges            ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships           ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawal_requests   ENABLE ROW LEVEL SECURITY;

-- profiles: readable by all, writable by owner
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- wallets: owner only
CREATE POLICY "wallets_own" ON wallets FOR ALL USING (auth.uid() = user_id);

-- challenges: public ones visible to all; private visible to creator + participants
CREATE POLICY "challenges_select" ON challenges FOR SELECT USING (
  type = 'public'
  OR creator_id = auth.uid()
  OR EXISTS (SELECT 1 FROM challenge_participants cp WHERE cp.challenge_id = id AND cp.user_id = auth.uid())
);
CREATE POLICY "challenges_insert" ON challenges FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "challenges_update" ON challenges FOR UPDATE USING (auth.uid() = creator_id);
CREATE POLICY "challenges_delete" ON challenges FOR DELETE USING (auth.uid() = creator_id);

-- participants: visible if challenge is public or you're involved
CREATE POLICY "participants_select" ON challenge_participants FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM challenges c WHERE c.id = challenge_id AND c.type = 'public')
  OR EXISTS (SELECT 1 FROM challenges c WHERE c.id = challenge_id AND c.creator_id = auth.uid())
);
CREATE POLICY "participants_insert" ON challenge_participants FOR INSERT WITH CHECK (auth.uid() = user_id);

-- votes: own only; write requires active participation in that challenge
CREATE POLICY "votes_own" ON votes FOR ALL
  USING (auth.uid() = voter_id)
  WITH CHECK (
    auth.uid() = voter_id
    AND EXISTS (
      SELECT 1 FROM challenge_participants cp
      WHERE cp.challenge_id = votes.challenge_id
        AND cp.user_id = auth.uid()
        AND cp.status = 'active'
    )
  );

-- friendships: own
CREATE POLICY "friendships_select" ON friendships FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE POLICY "friendships_insert" ON friendships FOR INSERT WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "friendships_update" ON friendships FOR UPDATE USING (auth.uid() = addressee_id);
CREATE POLICY "friendships_delete" ON friendships FOR DELETE USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- transactions: own only
CREATE POLICY "transactions_select" ON transactions FOR SELECT USING (auth.uid() = user_id);

-- withdrawal_requests: own only
CREATE POLICY "withdrawals_own" ON withdrawal_requests FOR ALL USING (auth.uid() = user_id);

-- ─── Lock down service-role-only RPCs ────────────────────────────────────────
-- These functions are only called by edge functions running with the service role
-- key. Revoking from PUBLIC prevents authenticated app users from calling them
-- directly with arbitrary user IDs (money manipulation).

REVOKE EXECUTE ON FUNCTION increment_wallet(UUID, NUMERIC)  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION forfeit_locked(UUID, NUMERIC)    FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION release_locked(UUID, NUMERIC)    FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION request_withdrawal(UUID, NUMERIC) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION increment_wallet(UUID, NUMERIC)   TO service_role;
GRANT EXECUTE ON FUNCTION forfeit_locked(UUID, NUMERIC)     TO service_role;
GRANT EXECUTE ON FUNCTION release_locked(UUID, NUMERIC)     TO service_role;
GRANT EXECUTE ON FUNCTION request_withdrawal(UUID, NUMERIC) TO service_role;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  verification.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

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

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  verification_logic.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

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

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  settlement.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ════════════════════════════════════════════════════════════════════════════
-- SETTLEMENT — completion-based payout (replaces peer-vote tally)
-- ════════════════════════════════════════════════════════════════════════════
-- Depends on schema.sql + verification.sql + verification_logic.sql.
--
-- New outcome rule (the core product difference): you win by completing the
-- CHALLENGE, not by beating other players. `participant_succeeded()` decides
-- pass/fail from approved submissions. Winners get their stake back PLUS an equal
-- share of the pot forfeited by those who failed.
--
-- Settlement runs as ONE atomic plpgsql transaction (the old edge function did
-- many separate awaits — unsafe for money). Every movement is written to
-- points_ledger, the source of truth.
--
-- ⚖️ LEGAL: this whole function is the payout engine — gambling/odds/escrow/tax
--     all attach here. Counsel review required before real money flows.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION settle_challenge(p_challenge_id UUID, p_force BOOLEAN DEFAULT FALSE)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status TEXT; v_bet NUMERIC; v_fee INT; v_creator UUID; v_goal TEXT;
  v_undecided INT; v_winners INT := 0; v_losers INT := 0;
  v_forfeit NUMERIC := 0; v_creator_fee NUMERIC := 0; v_distributable NUMERIC := 0; v_per NUMERIC := 0;
  v_creator_won BOOLEAN; r RECORD;
BEGIN
  SELECT status, bet_amount, creator_fee_percent, creator_id, goal
    INTO v_status, v_bet, v_fee, v_creator, v_goal
  FROM challenges WHERE id = p_challenge_id;

  IF v_status IS NULL THEN RAISE EXCEPTION 'Challenge not found.'; END IF;
  IF v_status = 'completed' THEN RETURN json_build_object('status','already_completed'); END IF;

  -- Don't settle while proof is still being verified — failing a player because a
  -- reviewer was slow is unfair. The lifecycle cron calls with p_force=TRUE only
  -- after the grace window, at which point undecided proof is treated as failed.
  SELECT COUNT(*) INTO v_undecided FROM submissions
   WHERE challenge_id = p_challenge_id AND status IN ('pending_ml','in_review');

  IF v_undecided > 0 AND NOT p_force THEN
    RETURN json_build_object('status','pending_reviews','undecided',v_undecided);
  END IF;

  IF v_undecided > 0 AND p_force THEN
    UPDATE submissions SET status = 'rejected', decided_at = NOW(),
           decided_reason = 'auto: verification window closed'
     WHERE challenge_id = p_challenge_id AND status IN ('pending_ml','in_review');
  END IF;

  -- Tally outcomes for active participants.
  CREATE TEMP TABLE _out ON COMMIT DROP AS
    SELECT cp.user_id, participant_succeeded(p_challenge_id, cp.user_id) AS won
    FROM challenge_participants cp
    WHERE cp.challenge_id = p_challenge_id AND cp.status = 'active';

  SELECT COUNT(*) FILTER (WHERE won), COUNT(*) FILTER (WHERE NOT won)
    INTO v_winners, v_losers FROM _out;

  -- No winners ⇒ refund everyone (no money created or destroyed).
  IF v_winners = 0 THEN
    FOR r IN SELECT user_id FROM _out LOOP
      PERFORM release_locked(r.user_id, v_bet);
      PERFORM post_ledger(r.user_id, p_challenge_id, 'refund', v_bet, 'no winners');
      INSERT INTO transactions (user_id, type, amount, description)
      VALUES (r.user_id, 'refund', v_bet, 'Refund: ' || v_goal || ' (no winners)');
      UPDATE challenge_participants SET status = 'won'
        WHERE challenge_id = p_challenge_id AND user_id = r.user_id;
    END LOOP;
    UPDATE challenges SET status = 'completed' WHERE id = p_challenge_id;
    RETURN json_build_object('status','completed','winners',0,'refunded',v_losers);
  END IF;

  v_forfeit := v_losers * v_bet;

  SELECT bool_or(won) INTO v_creator_won FROM _out WHERE user_id = v_creator;
  v_creator_won := COALESCE(v_creator_won, FALSE);

  -- ⚖️ LEGAL: creator fee taken from the forfeited pool (not from winners' own
  --     stakes), and waived if the creator themselves won (anti self-dealing).
  v_creator_fee := CASE WHEN (NOT v_creator_won) AND v_fee > 0 THEN v_forfeit * v_fee / 100.0 ELSE 0 END;
  v_distributable := v_forfeit - v_creator_fee;
  v_per := v_distributable / v_winners;

  -- Winners: stake back + equal share of the forfeited pool.
  FOR r IN SELECT user_id FROM _out WHERE won LOOP
    PERFORM release_locked(r.user_id, v_bet);
    PERFORM post_ledger(r.user_id, p_challenge_id, 'stake_release', v_bet, 'stake returned');
    IF v_per > 0 THEN
      PERFORM increment_wallet(r.user_id, v_per);
      PERFORM post_ledger(r.user_id, p_challenge_id, 'winnings', v_per, 'share of forfeited pot');
      INSERT INTO transactions (user_id, type, amount, description)
      VALUES (r.user_id, 'win', v_per, 'Won: ' || v_goal);
    END IF;
    UPDATE challenge_participants SET status = 'won'
      WHERE challenge_id = p_challenge_id AND user_id = r.user_id;
  END LOOP;

  -- Losers: forfeit stake.
  FOR r IN SELECT user_id FROM _out WHERE NOT won LOOP
    PERFORM forfeit_locked(r.user_id, v_bet);
    PERFORM post_ledger(r.user_id, p_challenge_id, 'stake_forfeit', -v_bet, 'challenge not completed');
    UPDATE challenge_participants SET status = 'eliminated'
      WHERE challenge_id = p_challenge_id AND user_id = r.user_id;
  END LOOP;

  -- Creator fee.
  IF v_creator_fee > 0 THEN
    PERFORM increment_wallet(v_creator, v_creator_fee);
    PERFORM post_ledger(v_creator, p_challenge_id, 'creator_fee', v_creator_fee, 'creator fee');
    INSERT INTO transactions (user_id, type, amount, description)
    VALUES (v_creator, 'win', v_creator_fee, 'Creator fee: ' || v_goal);
  END IF;

  UPDATE challenges SET status = 'completed' WHERE id = p_challenge_id;

  RETURN json_build_object('status','completed','winners',v_winners,'losers',v_losers,
                           'per_winner', round(v_per,2), 'creator_fee', round(v_creator_fee,2));
END; $$;


-- ─── Keep the funnel unstuck: push stale work forward (cron, every few min) ────
CREATE OR REPLACE FUNCTION escalate_stale_reviews()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n INT := 0; r RECORD;
BEGIN
  -- pending_ml too long ⇒ worker probably missed it; route to human review
  UPDATE submissions SET status = 'in_review'
   WHERE status = 'pending_ml' AND created_at < NOW() - INTERVAL '30 minutes';

  -- make sure every in_review item has its quorum of neutral reviewers
  FOR r IN SELECT id FROM submissions WHERE status = 'in_review' LOOP
    PERFORM assign_reviewers(r.id);
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END; $$;


-- ─── Grants ───────────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION settle_challenge(UUID, BOOLEAN)  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION escalate_stale_reviews()         FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION settle_challenge(UUID, BOOLEAN)  TO service_role;
GRANT  EXECUTE ON FUNCTION escalate_stale_reviews()         TO service_role;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  security.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ════════════════════════════════════════════════════════════════════════════
-- SECURITY HARDENING — function execution lockdown
-- ════════════════════════════════════════════════════════════════════════════
-- Run AFTER schema.sql + verification.sql + verification_logic.sql + settlement.sql.
--
-- Why this is needed: Supabase grants EXECUTE to `anon` + `authenticated` by
-- default, and every role inherits `PUBLIC`. So `REVOKE ... FROM PUBLIC` alone is
-- NOT enough — you must revoke PUBLIC *and* the role grants. Without this,
-- signed-in users could call settle_challenge / post_ledger / increment_wallet
-- directly (money manipulation). Verified via the Supabase security advisor.
--
-- (Deployed functions are also defined with `SET search_path = public`.)
-- ════════════════════════════════════════════════════════════════════════════

-- Service-role only: money, admin, internal, trigger.
REVOKE EXECUTE ON FUNCTION
  post_ledger(uuid, uuid, ledger_entry_type, numeric, text),
  ensure_daily_token(uuid, date),
  rotate_daily_tokens(),
  assign_groups(uuid),
  assign_reviewers(uuid, integer),
  ingest_ml_result(uuid, integer, numeric, jsonb, boolean),
  settle_challenge(uuid, boolean),
  escalate_stale_reviews(),
  increment_wallet(uuid, numeric),
  forfeit_locked(uuid, numeric),
  release_locked(uuid, numeric),
  request_withdrawal(uuid, numeric),
  transition_challenge_statuses(),
  handle_new_user()
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION transition_challenge_statuses() TO service_role;

-- User-callable definer RPCs: authenticated only, never anon. They enforce
-- auth.uid() internally; is_group_peer/is_reviewer_for must stay executable by
-- authenticated so RLS policy evaluation can call them without recursion.
REVOKE EXECUTE ON FUNCTION
  join_challenge(uuid),
  create_submission(uuid, text, numeric, date),
  submit_flag(uuid, flag_reason, text),
  submit_review(uuid, review_decision, text),
  get_profile_stats(uuid),
  is_group_peer(uuid),
  is_reviewer_for(uuid)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  join_challenge(uuid),
  create_submission(uuid, text, numeric, date),
  submit_flag(uuid, flag_reason, text),
  submit_review(uuid, review_decision, text),
  get_profile_stats(uuid),
  is_group_peer(uuid),
  is_reviewer_for(uuid)
TO authenticated;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  performance.sql
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ════════════════════════════════════════════════════════════════════════════
-- PERFORMANCE — FK covering indexes + RLS initplan optimization
-- ════════════════════════════════════════════════════════════════════════════
-- Run after all other modules. Addresses Supabase performance-advisor findings:
--   • unindexed_foreign_keys  → covering indexes below
--   • auth_rls_initplan        → wrap auth.uid() in (select auth.uid()) so it's
--                                evaluated once per query instead of per row
-- (The advisor's "unused_index" notices are false positives on a fresh DB.)

-- ── Covering indexes for foreign keys ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cp_user             ON challenge_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_challenges_creator  ON challenges(creator_id);
CREATE INDEX IF NOT EXISTS idx_friendships_addr    ON friendships(addressee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer    ON reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_submissions_token   ON submissions(token_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user   ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_votes_voter         ON votes(voter_id);
CREATE INDEX IF NOT EXISTS idx_votes_target        ON votes(target_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user    ON withdrawal_requests(user_id);

-- ── RLS policies recreated with (select auth.uid()) ──────────────────────────
DROP POLICY IF EXISTS profiles_update ON profiles;
CREATE POLICY profiles_update ON profiles FOR UPDATE USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS wallets_own ON wallets;
CREATE POLICY wallets_own ON wallets FOR ALL USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS challenges_select ON challenges;
CREATE POLICY challenges_select ON challenges FOR SELECT USING (
  type = 'public'
  OR creator_id = (select auth.uid())
  OR EXISTS (SELECT 1 FROM challenge_participants cp WHERE cp.challenge_id = id AND cp.user_id = (select auth.uid()))
);
DROP POLICY IF EXISTS challenges_insert ON challenges;
CREATE POLICY challenges_insert ON challenges FOR INSERT WITH CHECK ((select auth.uid()) = creator_id);
DROP POLICY IF EXISTS challenges_update ON challenges;
CREATE POLICY challenges_update ON challenges FOR UPDATE USING ((select auth.uid()) = creator_id);
DROP POLICY IF EXISTS challenges_delete ON challenges;
CREATE POLICY challenges_delete ON challenges FOR DELETE USING ((select auth.uid()) = creator_id);

DROP POLICY IF EXISTS participants_select ON challenge_participants;
CREATE POLICY participants_select ON challenge_participants FOR SELECT USING (
  user_id = (select auth.uid())
  OR EXISTS (SELECT 1 FROM challenges c WHERE c.id = challenge_id AND c.type = 'public')
  OR EXISTS (SELECT 1 FROM challenges c WHERE c.id = challenge_id AND c.creator_id = (select auth.uid()))
);
DROP POLICY IF EXISTS participants_insert ON challenge_participants;
CREATE POLICY participants_insert ON challenge_participants FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS votes_own ON votes;
CREATE POLICY votes_own ON votes FOR ALL
  USING ((select auth.uid()) = voter_id)
  WITH CHECK (
    (select auth.uid()) = voter_id
    AND EXISTS (SELECT 1 FROM challenge_participants cp
                WHERE cp.challenge_id = votes.challenge_id AND cp.user_id = (select auth.uid()) AND cp.status = 'active')
  );

DROP POLICY IF EXISTS friendships_select ON friendships;
CREATE POLICY friendships_select ON friendships FOR SELECT USING ((select auth.uid()) = requester_id OR (select auth.uid()) = addressee_id);
DROP POLICY IF EXISTS friendships_insert ON friendships;
CREATE POLICY friendships_insert ON friendships FOR INSERT WITH CHECK ((select auth.uid()) = requester_id);
DROP POLICY IF EXISTS friendships_update ON friendships;
CREATE POLICY friendships_update ON friendships FOR UPDATE USING ((select auth.uid()) = addressee_id);
DROP POLICY IF EXISTS friendships_delete ON friendships;
CREATE POLICY friendships_delete ON friendships FOR DELETE USING ((select auth.uid()) = requester_id OR (select auth.uid()) = addressee_id);

DROP POLICY IF EXISTS transactions_select ON transactions;
CREATE POLICY transactions_select ON transactions FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS withdrawals_own ON withdrawal_requests;
CREATE POLICY withdrawals_own ON withdrawal_requests FOR ALL USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS groups_select ON accountability_groups;
CREATE POLICY groups_select ON accountability_groups FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM group_members gm WHERE gm.challenge_id = accountability_groups.challenge_id AND gm.user_id = (select auth.uid()))
);

DROP POLICY IF EXISTS group_members_select ON group_members;
CREATE POLICY group_members_select ON group_members FOR SELECT TO authenticated USING (
  user_id = (select auth.uid())
  OR EXISTS (SELECT 1 FROM group_members me WHERE me.group_id = group_members.group_id AND me.user_id = (select auth.uid()))
);

DROP POLICY IF EXISTS daily_tokens_select ON daily_tokens;
CREATE POLICY daily_tokens_select ON daily_tokens FOR SELECT TO authenticated USING (
  token_date <= CURRENT_DATE
  AND EXISTS (SELECT 1 FROM challenge_participants cp WHERE cp.challenge_id = daily_tokens.challenge_id AND cp.user_id = (select auth.uid()))
);

DROP POLICY IF EXISTS submissions_select ON submissions;
CREATE POLICY submissions_select ON submissions FOR SELECT TO authenticated USING (
  user_id = (select auth.uid()) OR is_group_peer(id) OR is_reviewer_for(id)
);

DROP POLICY IF EXISTS flags_select ON submission_flags;
CREATE POLICY flags_select ON submission_flags FOR SELECT TO authenticated USING (
  flagger_id = (select auth.uid()) OR is_group_peer(submission_id) OR is_reviewer_for(submission_id)
);

DROP POLICY IF EXISTS assignments_select ON reviewer_assignments;
CREATE POLICY assignments_select ON reviewer_assignments FOR SELECT TO authenticated USING (reviewer_id = (select auth.uid()));

DROP POLICY IF EXISTS reviews_select ON reviews;
CREATE POLICY reviews_select ON reviews FOR SELECT TO authenticated USING (
  reviewer_id = (select auth.uid()) OR is_group_peer(submission_id)
);

DROP POLICY IF EXISTS reputation_own ON flagger_reputation;
CREATE POLICY reputation_own ON flagger_reputation FOR SELECT TO authenticated USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS ledger_own ON points_ledger;
CREATE POLICY ledger_own ON points_ledger FOR SELECT TO authenticated USING (user_id = (select auth.uid()));

-- ════════════════════════════════════════════════════════════════════════════
-- Migration 09 — fix RLS recursion + profiles FK embeds (must run last).
-- The challenges_select / participants_select policies recreated above still
-- reference each other's table directly (42P17 recursion); these override them
-- with SECURITY DEFINER helpers and add the profiles FKs PostgREST needs.
-- Canonical copy: rls_fix.sql.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.is_member(p_challenge uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM challenge_participants cp
                 WHERE cp.challenge_id = p_challenge AND cp.user_id = (select auth.uid()));
$$;
CREATE OR REPLACE FUNCTION public.can_see_challenge(p_challenge uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM challenges c
                 WHERE c.id = p_challenge AND (c.type = 'public' OR c.creator_id = (select auth.uid())));
$$;
GRANT EXECUTE ON FUNCTION public.is_member(uuid), public.can_see_challenge(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS challenges_select ON challenges;
CREATE POLICY challenges_select ON challenges FOR SELECT USING (
  type = 'public' OR creator_id = (select auth.uid()) OR is_member(id)
);
DROP POLICY IF EXISTS participants_select ON challenge_participants;
CREATE POLICY participants_select ON challenge_participants FOR SELECT USING (
  user_id = (select auth.uid()) OR can_see_challenge(challenge_id)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'challenges_creator_profiles_fkey') THEN
    ALTER TABLE challenges ADD CONSTRAINT challenges_creator_profiles_fkey
      FOREIGN KEY (creator_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'challenge_participants_user_profiles_fkey') THEN
    ALTER TABLE challenge_participants ADD CONSTRAINT challenge_participants_user_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'friendships_requester_profiles_fkey') THEN
    ALTER TABLE friendships ADD CONSTRAINT friendships_requester_profiles_fkey
      FOREIGN KEY (requester_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'friendships_addressee_profiles_fkey') THEN
    ALTER TABLE friendships ADD CONSTRAINT friendships_addressee_profiles_fkey
      FOREIGN KEY (addressee_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'submissions_user_profiles_fkey') THEN
    ALTER TABLE submissions ADD CONSTRAINT submissions_user_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
