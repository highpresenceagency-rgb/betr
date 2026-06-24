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
