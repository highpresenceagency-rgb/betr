"""Suspicion signals. Each returns a float in [0,1] (1 = most suspicious), except
token detection which returns a tri-state bool|None (None = couldn't tell).

These are intentionally simple, explainable heuristics — the point is a layered
funnel, not a single magic model. Anything ambiguous routes to human review
rather than auto-failing, so false positives cost a review, not a user's stake.
"""
from __future__ import annotations
import numpy as np
import cv2

# easyocr is heavy (and wants a GPU). Import lazily so the worker still runs for
# rep-counting if OCR isn't installed; token check then returns None (unknown).
_reader = None


def _ocr_reader():
    global _reader
    if _reader is None:
        import easyocr  # type: ignore
        _reader = easyocr.Reader(["en"], gpu=True)
    return _reader


def detect_token(video_path: str, expected: str | None, scan_seconds: float) -> bool | None:
    """Was the expected token shown/written in the opening seconds of the clip?

    Reads text from sampled intro frames via OCR. Returns True/False, or None if
    OCR is unavailable or no expected token exists (caller treats None as 'unknown'
    → routes to review rather than auto-approving).

    NOTE: this catches *shown* tokens. For *spoken* tokens, add an ASR pass
    (e.g. faster-whisper) over the same intro window and OR the two results.
    """
    if not expected:
        return None
    try:
        reader = _ocr_reader()
    except Exception:
        return None

    want = expected.lower().replace("-", " ").split()
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    max_frame = int(scan_seconds * fps)
    seen: set[str] = set()
    i = 0
    try:
        while i < max_frame:
            ok, frame = cap.read()
            if not ok:
                break
            if i % max(1, int(fps / 3)) == 0:  # ~3 samples/sec
                for txt in reader.readtext(frame, detail=0):
                    for w in str(txt).lower().replace("-", " ").split():
                        seen.add(w)
            i += 1
    finally:
        cap.release()
    # require a majority of the token's words to appear
    hits = sum(1 for w in want if w in seen)
    return hits >= max(1, (len(want) + 1) // 2)


def rep_shortfall(rep_count: int, target: int | None) -> float:
    if not target or target <= 0:
        return 0.0
    return float(max(0.0, min(1.0, (target - rep_count) / target)))


def sped_up(rep_count: int, duration_s: float, max_reps_per_sec: float) -> float:
    """Implausibly fast cadence ⇒ likely sped-up playback."""
    if duration_s <= 0 or rep_count <= 0:
        return 0.0
    rate = rep_count / duration_s
    if rate <= max_reps_per_sec:
        return 0.0
    # scale 0→1 as rate goes from the cap to 2x the cap
    return float(min(1.0, (rate - max_reps_per_sec) / max_reps_per_sec))


def looped(video_path: str, sample_every: int = 5) -> float:
    """Detect duplicated/looped segments via perceptual frame hashing.

    Repeated near-identical frames far apart in time indicate a looped or
    spliced clip. Returns the fraction of sampled frames that are duplicates.
    """
    cap = cv2.VideoCapture(video_path)
    hashes: list[int] = []
    i = 0
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            if i % sample_every == 0:
                small = cv2.resize(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY), (16, 16))
                bits = (small > small.mean()).astype(np.uint8).flatten()
                hashes.append(int("".join(map(str, bits)), 2))
            i += 1
    finally:
        cap.release()
    if len(hashes) < 8:
        return 0.0
    # count hashes that recur (Hamming distance 0) — cheap exact-dup proxy
    from collections import Counter
    counts = Counter(hashes)
    dupes = sum(c - 1 for c in counts.values() if c > 1)
    return float(min(1.0, dupes / len(hashes)))


def person_inconsistent(torso: list[float | None]) -> float:
    """Body proportions should be stable within one clip; a big jump suggests a
    person swap mid-video. Returns normalized variability of torso length."""
    vals = [t for t in torso if t]
    if len(vals) < 8:
        return 0.0
    arr = np.array(vals)
    med = np.median(arr)
    if med == 0:
        return 0.0
    # robust spread relative to median; clamp
    spread = float(np.median(np.abs(arr - med)) / med)
    return float(min(1.0, spread * 4.0))
