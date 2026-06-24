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
