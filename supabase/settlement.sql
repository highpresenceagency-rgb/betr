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
