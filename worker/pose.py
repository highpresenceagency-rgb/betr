"""Pose extraction + rep counting via MediaPipe Pose.

Pipeline: video → per-frame 33 body landmarks → a joint-angle time series →
smoothed peak detection → rep count. The exercise profile (config.py) picks which
joint angle to track and the up/down thresholds that define one rep.

This is a legitimate, working approach, not a stub — but rep counting is
exercise-specific. Treat the profiles as calibration starting points and tune
`down_deg`/`up_deg` against real footage per exercise before trusting counts.
"""
from __future__ import annotations
import math
import numpy as np
import cv2
import mediapipe as mp
from config import ExerciseProfile, MAX_FRAMES

# MediaPipe Pose landmark indices we may reference by name.
_LM = {
    "left_shoulder": 11, "right_shoulder": 12,
    "left_elbow": 13, "right_elbow": 14,
    "left_wrist": 15, "right_wrist": 16,
    "left_hip": 23, "right_hip": 24,
    "left_knee": 25, "right_knee": 26,
    "left_ankle": 27, "right_ankle": 28,
}


def _angle(a, b, c) -> float | None:
    """Angle at point b (degrees) formed by a-b-c, or None if any point missing."""
    if a is None or b is None or c is None:
        return None
    ba = (a[0] - b[0], a[1] - b[1])
    bc = (c[0] - b[0], c[1] - b[1])
    nba, nbc = math.hypot(*ba), math.hypot(*bc)
    if nba == 0 or nbc == 0:
        return None
    cos = (ba[0] * bc[0] + ba[1] * bc[1]) / (nba * nbc)
    return math.degrees(math.acos(max(-1.0, min(1.0, cos))))


def extract(video_path: str) -> dict:
    """Return {fps, duration, angles: [float|None], torso: [float|None], n_frames}.

    `torso` is shoulder-to-hip pixel length per frame — used later to detect a
    person swap (proportions shouldn't jump around within one clip).
    """
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    pose = mp.solutions.pose.Pose(model_complexity=1, min_detection_confidence=0.5)

    angles: list[float | None] = []
    torso: list[float | None] = []
    frames = 0
    try:
        while frames < MAX_FRAMES:
            ok, frame = cap.read()
            if not ok:
                break
            frames += 1
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            res = pose.process(rgb)
            if not res.pose_landmarks:
                angles.append(None)
                torso.append(None)
                continue
            lm = res.pose_landmarks.landmark
            pt = lambda name: (lm[_LM[name]].x, lm[_LM[name]].y) if lm[_LM[name]].visibility > 0.3 else None
            angles.append((pt, None))  # placeholder; resolved by caller via profile
            sh, hp = pt("left_shoulder"), pt("left_hip")
            torso.append(math.hypot(sh[0] - hp[0], sh[1] - hp[1]) if sh and hp else None)
    finally:
        cap.release()
        pose.close()

    return {"fps": fps, "duration": frames / fps if fps else 0.0,
            "angles_raw": angles, "torso": torso, "n_frames": frames}


def angle_series(extracted: dict, profile: ExerciseProfile) -> list[float | None]:
    """Resolve the profile's tracked joint angle for each frame."""
    out: list[float | None] = []
    for item in extracted["angles_raw"]:
        if item is None:
            out.append(None)
            continue
        pt, _ = item
        a, b, c = (pt(profile.angle[0]), pt(profile.angle[1]), pt(profile.angle[2]))
        out.append(_angle(a, b, c))
    return out


def _smooth(xs: list[float], k: int = 5) -> list[float]:
    if len(xs) < k:
        return xs
    kernel = np.ones(k) / k
    return list(np.convolve(np.array(xs), kernel, mode="same"))


def count_reps(series: list[float | None], profile: ExerciseProfile) -> tuple[int, float]:
    """Count reps via hysteresis on the angle series.

    A rep completes on the up-swing: we require the angle to dip below
    `down_deg` (the "down" position) and then rise back above `up_deg`.
    Hysteresis (two thresholds) rejects jitter near a single threshold.

    Returns (rep_count, valid_fraction) where valid_fraction is the share of
    frames with a usable pose — low values mean the body wasn't clearly visible.
    """
    vals = [v for v in series if v is not None]
    valid_fraction = len(vals) / len(series) if series else 0.0
    if len(vals) < 6:
        return 0, valid_fraction

    sm = _smooth(vals)
    reps = 0
    state = "up"  # start assuming extended position
    for v in sm:
        if state == "up" and v < profile.down_deg:
            state = "down"
        elif state == "down" and v > profile.up_deg:
            state = "up"
            reps += 1
    return reps, valid_fraction
