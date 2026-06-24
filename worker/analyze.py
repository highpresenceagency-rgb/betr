"""Orchestrator: submission row → full ML verdict payload.

Combines the rep count and each suspicion signal into a single 0..1 score using
the weights in config.SIGNAL_WEIGHTS. Returns exactly what `ingest_ml_result`
expects, plus a human-readable breakdown stored in `signals` for auditability
and for showing reviewers *why* something was routed to them.
"""
from __future__ import annotations
import os
import config
import pose
import signals
import supabase_client as sb


def analyze_submission(sub: dict) -> dict:
    goal = sb.get_goal(sub["challenge_id"])
    profile = config.profile_for_goal(goal)
    expected_token = sb.get_expected_token(sub["challenge_id"], sub["proof_date"])

    local = sb.download_video(sub["video_path"])
    try:
        extracted = pose.extract(local)
        series = pose.angle_series(extracted, profile)
        rep_count, valid_fraction = pose.count_reps(series, profile)
        duration = extracted["duration"]

        token_ok = signals.detect_token(local, expected_token, config.TOKEN_SCAN_SECONDS)

        sig = {
            "token_missing": 1.0 if token_ok is False else (0.5 if token_ok is None else 0.0),
            "rep_shortfall": signals.rep_shortfall(rep_count, sub.get("ml_target")),
            "sped_up": signals.sped_up(rep_count, duration, profile.max_reps_per_sec),
            "looped": signals.looped(local),
            "person_inconsistent": signals.person_inconsistent(extracted["torso"]),
        }
        # low pose visibility is itself suspicious (can't verify the body)
        if valid_fraction < 0.5:
            sig["person_inconsistent"] = max(sig["person_inconsistent"], 1.0 - valid_fraction)

        suspicion = sum(config.SIGNAL_WEIGHTS[k] * v for k, v in sig.items())

        return {
            "rep_count": rep_count,
            "suspicion": round(suspicion, 3),
            "token_detected": token_ok,
            "signals": {
                **{k: round(v, 3) for k, v in sig.items()},
                "exercise": profile.name,
                "duration_s": round(duration, 1),
                "valid_pose_fraction": round(valid_fraction, 2),
                "expected_token_present": expected_token is not None,
            },
        }
    finally:
        try:
            os.unlink(local)
        except OSError:
            pass


def process(submission_id: str) -> dict:
    sub = sb.get_submission(submission_id)
    if not sub:
        return {"error": "not found"}
    if sub["status"] != "pending_ml":
        return {"skipped": f"status={sub['status']}"}
    verdict = analyze_submission(sub)
    if "error" in verdict:
        return verdict
    status = sb.ingest_result(
        submission_id, verdict["rep_count"], verdict["suspicion"],
        verdict["signals"], verdict["token_detected"],
    )
    return {"submission_id": submission_id, "result_status": status, **verdict}
