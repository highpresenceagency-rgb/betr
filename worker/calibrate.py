"""Calibrate rep-counting thresholds against REAL footage.

You supply a folder of labeled clips; this sweeps the up/down joint-angle
thresholds per exercise, picks the values that minimize rep-count error, and
derives a plausible max cadence (for the sped-up signal). It writes
`calibration.json`, which the worker auto-loads on next start (see
config._apply_calibration) — no code edits needed.

Usage
-----
1. Collect clips and label them. In the clips folder create `labels.csv`:

       file,exercise,reps
       jake_pushups_01.mp4,pushup,20
       mara_squats_03.mp4,squat,15
       ...

   `exercise` should match a profile name (pushup, squat, situp, jumpingjack)
   or any goal text — it's matched the same way the worker matches challenges.

2. Run (in the worker's Python env, with mediapipe/opencv installed):

       python calibrate.py --clips ./labeled_clips --out calibration.json

3. Review the printed before/after MAE, then deploy calibration.json alongside
   the worker. Re-run whenever you gather more footage.

This does NOT touch the database or network — it only reads local video.
"""
from __future__ import annotations
import argparse
import csv
import dataclasses
import json
import os
from collections import defaultdict

import config
import pose

# Search grid (degrees). up must clear down by a margin to avoid jitter doubles.
DOWN_RANGE = range(70, 131, 5)
UP_RANGE = range(120, 176, 5)
MIN_MARGIN = 25


def load_labels(clips_dir: str) -> list[dict]:
    path = os.path.join(clips_dir, "labels.csv")
    if not os.path.exists(path):
        raise SystemExit(f"No labels.csv found in {clips_dir}. See the header of calibrate.py for the format.")
    rows: list[dict] = []
    with open(path, newline="") as f:
        for r in csv.DictReader(f):
            if not r.get("file"):
                continue
            rows.append({
                "file": r["file"].strip(),
                "exercise": (r.get("exercise") or "").strip().lower(),
                "reps": int(float(r["reps"])),
            })
    if not rows:
        raise SystemExit("labels.csv has no rows.")
    return rows


def base_profile(name: str) -> config.ExerciseProfile:
    for p in config.PROFILES:
        if p.name == name:
            return p
    return config.profile_for_goal(name)  # keyword match, else GENERIC


def mae_for(prepared: list[tuple[list, int]], profile: config.ExerciseProfile) -> float:
    total = sum(abs(pose.count_reps(series, profile)[0] - truth) for series, truth in prepared)
    return total / len(prepared)


def sweep(prepared: list[tuple[list, int]], base: config.ExerciseProfile) -> tuple[float, int, int]:
    best: tuple[float, int, int] | None = None
    for down in DOWN_RANGE:
        for up in UP_RANGE:
            if up - down < MIN_MARGIN:
                continue
            cand = dataclasses.replace(base, down_deg=float(down), up_deg=float(up))
            mae = mae_for(prepared, cand)
            if best is None or mae < best[0]:
                best = (mae, down, up)
    assert best is not None
    return best


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--clips", required=True, help="folder containing labeled clips + labels.csv")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "calibration.json"))
    args = ap.parse_args()

    labels = load_labels(args.clips)
    by_ex: dict[str, list[dict]] = defaultdict(list)
    for row in labels:
        by_ex[row["exercise"]].append(row)

    result: dict[str, dict] = {}
    for ex, items in by_ex.items():
        base = base_profile(ex)
        prepared: list[tuple[list, int]] = []
        cadences: list[float] = []
        print(f"\n[{ex}] {len(items)} clip(s) — extracting pose…")
        for it in items:
            vid = os.path.join(args.clips, it["file"])
            if not os.path.exists(vid):
                print(f"  ! missing {it['file']}, skipping")
                continue
            extracted = pose.extract(vid)
            series = pose.angle_series(extracted, base)
            prepared.append((series, it["reps"]))
            dur = extracted["duration"]
            if dur > 0 and it["reps"] > 0:
                cadences.append(it["reps"] / dur)
        if not prepared:
            print(f"  ! no usable clips for {ex}")
            continue

        before = mae_for(prepared, base)
        mae, down, up = sweep(prepared, base)
        max_cadence = max(cadences) if cadences else base.max_reps_per_sec
        mrps = round(max(0.5, max_cadence * 1.25), 2)

        result[ex] = {
            "down_deg": down, "up_deg": up, "max_reps_per_sec": mrps,
            "mae": round(mae, 2), "baseline_mae": round(before, 2), "clips": len(prepared),
        }
        print(f"  default down/up = {base.down_deg:.0f}/{base.up_deg:.0f}  MAE {before:.2f} reps")
        print(f"  tuned   down/up = {down}/{up}              MAE {mae:.2f} reps")
        print(f"  max_reps_per_sec = {mrps} (observed peak {max_cadence:.2f}/s)")

    if not result:
        raise SystemExit("\nNothing calibrated — check labels.csv and clip paths.")

    with open(args.out, "w") as f:
        json.dump(result, f, indent=2)
    print(f"\nWrote {args.out}. Deploy it next to the worker; it auto-loads on start.")


if __name__ == "__main__":
    main()
