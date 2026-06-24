"""Worker configuration + per-exercise rep-counting profiles.

Everything tunable lives here so the ML logic stays declarative. Exercise
profiles map a challenge goal (matched by keyword) to the joint-angle signal we
track and the peak-detection thresholds that define one rep. These defaults are
sane starting points — each exercise needs calibration against real footage
before you trust the rep counts in production.
"""
from __future__ import annotations
import os
from dataclasses import dataclass, field


def _env(name: str, default: str | None = None) -> str:
    return os.environ.get(name, default) or ""


# ─── Connection ───────────────────────────────────────────────────────────────
# Not required at import time so offline tools (e.g. calibrate.py) can import this
# module without Supabase creds. supabase_client.db() validates them when needed.
SUPABASE_URL = _env("SUPABASE_URL")
SERVICE_ROLE_KEY = _env("SUPABASE_SERVICE_ROLE_KEY")
PROOFS_BUCKET = _env("PROOFS_BUCKET", "proofs")

# ─── Runtime ────────────────────────────────────────────────────────────────────
POLL_INTERVAL_SECONDS = float(_env("POLL_INTERVAL_SECONDS", "5"))
POLL_BATCH = int(_env("POLL_BATCH", "4"))
MAX_FRAMES = int(_env("MAX_FRAMES", "900"))          # cap work per clip (~30s @ 30fps)
TOKEN_SCAN_SECONDS = float(_env("TOKEN_SCAN_SECONDS", "6"))  # only OCR the intro
ENABLE_POLLER = _env("ENABLE_POLLER", "true").lower() == "true"


@dataclass(frozen=True)
class ExerciseProfile:
    name: str
    keywords: tuple[str, ...]
    # which joint angle to track for rep peaks: ('a','b','c') = angle at b
    angle: tuple[str, str, str]
    # a rep = angle swings below `down_deg` then back above `up_deg`
    down_deg: float
    up_deg: float
    # human-plausible max reps/second (above this ⇒ likely sped up)
    max_reps_per_sec: float = 2.0


# Landmark names follow MediaPipe Pose. Angle is measured at the middle joint.
PROFILES: list[ExerciseProfile] = [
    ExerciseProfile("pushup", ("pushup", "push-up", "push up"),
                    ("left_shoulder", "left_elbow", "left_wrist"), down_deg=95, up_deg=150, max_reps_per_sec=1.5),
    ExerciseProfile("squat", ("squat",),
                    ("left_hip", "left_knee", "left_ankle"), down_deg=100, up_deg=160, max_reps_per_sec=1.2),
    ExerciseProfile("situp", ("situp", "sit-up", "sit up", "crunch"),
                    ("left_shoulder", "left_hip", "left_knee"), down_deg=100, up_deg=150, max_reps_per_sec=1.5),
    ExerciseProfile("jumpingjack", ("jumping jack", "jumping-jack", "jack"),
                    ("left_hip", "left_shoulder", "left_elbow"), down_deg=40, up_deg=150, max_reps_per_sec=2.5),
]
GENERIC = ExerciseProfile("generic", (),
                          ("left_shoulder", "left_elbow", "left_wrist"), down_deg=100, up_deg=150)


def _apply_calibration() -> None:
    """Override profile thresholds from calibration.json if present (written by
    calibrate.py against real footage). Keeps tuning out of code — drop the file
    next to this module and the worker picks it up on next start."""
    import dataclasses
    import json
    path = os.path.join(os.path.dirname(__file__), "calibration.json")
    if not os.path.exists(path):
        return
    try:
        with open(path) as f:
            data = json.load(f)
    except Exception:
        return
    for i, p in enumerate(PROFILES):
        o = data.get(p.name)
        if not o:
            continue
        PROFILES[i] = dataclasses.replace(
            p,
            down_deg=float(o.get("down_deg", p.down_deg)),
            up_deg=float(o.get("up_deg", p.up_deg)),
            max_reps_per_sec=float(o.get("max_reps_per_sec", p.max_reps_per_sec)),
        )


_apply_calibration()


def profile_for_goal(goal: str) -> ExerciseProfile:
    g = (goal or "").lower()
    for p in PROFILES:
        if any(k in g for k in p.keywords):
            return p
    return GENERIC


# ─── Suspicion-score weights (must sum to 1.0) ─────────────────────────────────
# Each signal is 0..1 (1 = most suspicious). Final score is their weighted sum.
SIGNAL_WEIGHTS = {
    "token_missing": 0.35,    # required intro token not seen
    "rep_shortfall": 0.20,    # fewer reps than the target
    "sped_up": 0.20,          # cadence implausibly fast
    "looped": 0.15,           # repeated/duplicate frame segments
    "person_inconsistent": 0.10,  # body proportions drift mid-clip
}
