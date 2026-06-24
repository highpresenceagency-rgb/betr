-- ════════════════════════════════════════════════════════════════════════════
-- Migration 09 — fix RLS recursion + add profiles FKs for PostgREST embeds
-- (deployed as 20260624114614 "09_fix_rls_recursion_and_profile_fks")
-- ════════════════════════════════════════════════════════════════════════════
--
-- Two production-breaking bugs the original schema shipped with:
--
--   1. INFINITE RECURSION (Postgres 42P17). challenges_select referenced
--      challenge_participants and participants_select referenced challenges, so
--      each policy triggered the other's RLS. Any read of either table errored.
--      Fix: move the cross-table check into SECURITY DEFINER helpers
--      (is_member / can_see_challenge) which read past RLS and break the loop.
--
--   2. POSTGREST EMBED FAILURE (PGRST200). creator_id / user_id / requester_id /
--      addressee_id had FKs to auth.users only, so `profiles!creator_id`-style
--      embeds (used all over lib/api.ts) had no relationship to resolve.
--      Fix: add a parallel FK to public.profiles(id). profiles.id is itself a PK
--      referencing auth.users, so integrity is preserved and the embed resolves.
--
-- Idempotent: safe to re-run. Apply AFTER schema.sql + verification.sql (it
-- references the submissions table).

-- ─── 1. SECURITY DEFINER helpers (break the recursion) ───────────────────────
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

GRANT EXECUTE ON FUNCTION public.is_member(uuid)         TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_see_challenge(uuid) TO anon, authenticated;

-- ─── 2. Non-recursive SELECT policies ────────────────────────────────────────
DROP POLICY IF EXISTS challenges_select ON challenges;
CREATE POLICY challenges_select ON challenges FOR SELECT USING (
  type = 'public'
  OR creator_id = (select auth.uid())
  OR is_member(id)
);

DROP POLICY IF EXISTS participants_select ON challenge_participants;
CREATE POLICY participants_select ON challenge_participants FOR SELECT USING (
  user_id = (select auth.uid())
  OR can_see_challenge(challenge_id)
);

-- ─── 3. profiles FKs for PostgREST embeds (alongside the existing auth.users FKs) ─
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

-- Tell PostgREST to pick up the new relationships immediately.
NOTIFY pgrst, 'reload schema';
