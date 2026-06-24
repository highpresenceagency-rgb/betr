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

-- SECURITY DEFINER helpers — keep challenges_select and participants_select from
-- referencing each other's RLS-protected table directly (which caused 42P17
-- infinite recursion). These read past RLS to evaluate the cross-table check.
-- See rls_fix.sql for the full rationale (deployed as migration 09).
CREATE OR REPLACE FUNCTION is_member(p_challenge UUID)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM challenge_participants cp
                 WHERE cp.challenge_id = p_challenge AND cp.user_id = (select auth.uid()));
$$;
CREATE OR REPLACE FUNCTION can_see_challenge(p_challenge UUID)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM challenges c
                 WHERE c.id = p_challenge AND (c.type = 'public' OR c.creator_id = (select auth.uid())));
$$;
GRANT EXECUTE ON FUNCTION is_member(UUID), can_see_challenge(UUID) TO anon, authenticated;

-- challenges: public ones visible to all; private visible to creator + participants
CREATE POLICY "challenges_select" ON challenges FOR SELECT USING (
  type = 'public'
  OR creator_id = (select auth.uid())
  OR is_member(id)
);
CREATE POLICY "challenges_insert" ON challenges FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "challenges_update" ON challenges FOR UPDATE USING (auth.uid() = creator_id);
CREATE POLICY "challenges_delete" ON challenges FOR DELETE USING (auth.uid() = creator_id);

-- participants: visible if challenge is public or you're involved
CREATE POLICY "participants_select" ON challenge_participants FOR SELECT USING (
  user_id = (select auth.uid())
  OR can_see_challenge(challenge_id)
);
CREATE POLICY "participants_insert" ON challenge_participants FOR INSERT WITH CHECK (auth.uid() = user_id);

-- profiles FKs so PostgREST can embed profiles!creator_id / profiles!user_id etc.
-- (these run alongside the auth.users FKs declared on the tables above).
ALTER TABLE challenges            ADD CONSTRAINT challenges_creator_profiles_fkey            FOREIGN KEY (creator_id)   REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE challenge_participants ADD CONSTRAINT challenge_participants_user_profiles_fkey FOREIGN KEY (user_id)      REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE friendships           ADD CONSTRAINT friendships_requester_profiles_fkey         FOREIGN KEY (requester_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE friendships           ADD CONSTRAINT friendships_addressee_profiles_fkey         FOREIGN KEY (addressee_id) REFERENCES profiles(id) ON DELETE CASCADE;

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
