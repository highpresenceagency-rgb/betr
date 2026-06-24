"""All Supabase I/O for the worker, using the service-role key (trusted backend).

The worker never touches user JWTs — it reads pending submissions, downloads the
private proof video, looks up the expected anti-replay token, and posts results
back through the `ingest_ml_result` RPC (which owns the auto-approve/route logic).
"""
from __future__ import annotations
import tempfile
from supabase import create_client, Client
import config

_client: Client | None = None


def db() -> Client:
    global _client
    if _client is None:
        if not config.SUPABASE_URL or not config.SERVICE_ROLE_KEY:
            raise RuntimeError(
                "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Set them in the "
                "worker environment (see .env.example).")
        _client = create_client(config.SUPABASE_URL, config.SERVICE_ROLE_KEY)
    return _client


def fetch_pending(limit: int) -> list[dict]:
    """Submissions waiting for the ML quick-pass, oldest first."""
    res = (
        db().table("submissions")
        .select("id, challenge_id, user_id, proof_date, video_path, ml_target")
        .eq("status", "pending_ml")
        .not_.is_("video_path", "null")
        .order("created_at", desc=False)
        .limit(limit)
        .execute()
    )
    return res.data or []


def get_submission(submission_id: str) -> dict | None:
    res = (
        db().table("submissions")
        .select("id, challenge_id, user_id, proof_date, video_path, ml_target, status")
        .eq("id", submission_id)
        .single()
        .execute()
    )
    return res.data


def get_goal(challenge_id: str) -> str:
    res = db().table("challenges").select("goal").eq("id", challenge_id).single().execute()
    return (res.data or {}).get("goal", "")


def get_expected_token(challenge_id: str, proof_date: str) -> str | None:
    res = (
        db().table("daily_tokens")
        .select("token_text")
        .eq("challenge_id", challenge_id)
        .eq("token_date", proof_date)
        .limit(1)
        .execute()
    )
    rows = res.data or []
    return rows[0]["token_text"] if rows else None


def download_video(video_path: str) -> str:
    """Download the private object to a temp file; return the local path."""
    data = db().storage.from_(config.PROOFS_BUCKET).download(video_path)
    suffix = "." + video_path.rsplit(".", 1)[-1] if "." in video_path else ".mp4"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.write(data)
    tmp.flush()
    tmp.close()
    return tmp.name


def ingest_result(submission_id: str, rep_count: int, suspicion: float,
                  signals: dict, token_detected: bool | None) -> str:
    """Hand the result to the DB, which decides auto_approve vs in_review."""
    res = db().rpc("ingest_ml_result", {
        "p_submission_id": submission_id,
        "p_rep_count": int(rep_count),
        "p_suspicion": round(float(suspicion), 2),
        "p_signals": signals,
        "p_token_detected": token_detected,
    }).execute()
    return res.data  # the new status string
