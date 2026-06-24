# Proof-verification worker

Self-hosted ML quick-pass for daily proof videos. Pulls `pending_ml` submissions,
runs pose-estimation rep counting + suspicion signals, and posts the verdict back
to Postgres via the `ingest_ml_result` RPC (which decides auto-approve vs. route
to human review). This is the **authoritative** score — the on-device counter in
the app is UX only and is never trusted here.

## How it fits

```
app records clip ─▶ uploads to Storage(proofs) ─▶ create_submission (status=pending_ml)
                                                          │
                  ┌───────────────────────────────────────┴──────────┐
            PUSH: ml-dispatch edge fn ─▶ POST /process       POLL: worker claims
                  (low latency)                              pending_ml every 5s
                                                          │
                          analyze.py: pose reps + token OCR + sped-up + loop + person
                                                          │
                              ingest_ml_result(rep_count, suspicion, signals, token)
                                                          │
                         suspicion < threshold & token & reps ⇒ auto_approved
                                          else ⇒ in_review ─▶ assign_reviewers
```

## Files
- `config.py` — env + per-exercise rep profiles + signal weights (tune here)
- `pose.py` — MediaPipe landmarks → joint-angle series → hysteresis rep count
- `signals.py` — token OCR, sped-up, looped-frame, person-consistency signals
- `analyze.py` — combines everything into the 0..1 suspicion score
- `supabase_client.py` — service-role I/O (download clip, read token, ingest)
- `main.py` — FastAPI: `POST /process`, `GET /healthz`, background poller

## Run locally
```bash
cp .env.example .env        # fill in SUPABASE_URL + SERVICE_ROLE_KEY
pip install -r requirements.txt
uvicorn main:app --reload --port 8080
curl -X POST localhost:8080/process -H 'content-type: application/json' \
     -d '{"submission_id":"<uuid>"}'
```

## Deploy (GPU)
Any container host works. For real throughput use a GPU instance and swap the
Dockerfile base to `nvidia/cuda:12.*-runtime` + CUDA builds of torch/easyocr.
- **Modal** or **Fly.io GPU**: simplest path to an always-on GPU container.
- **Cloud Run** (CPU) works for low volume / rep-counting-only (drop `easyocr`).

Set the same env vars in the host. If you only want PUSH, set `ENABLE_POLLER=false`
and point `ml-dispatch` (edge function) at this service's URL via `ML_WORKER_URL`.

## Calibrate rep thresholds against real footage  ← do this before trusting counts

The default `down_deg`/`up_deg` per exercise are starting points. `calibrate.py`
tunes them from clips you've labeled, with no DB/network access:

1. Put clips in a folder with a `labels.csv` (see `labels.example.csv`):

   ```csv
   file,exercise,reps
   jake_pushups_01.mp4,pushup,20
   mara_squats_03.mp4,squat,15
   ```

2. In the worker env (mediapipe/opencv installed):

   ```bash
   python calibrate.py --clips ./labeled_clips --out calibration.json
   ```

   It prints baseline vs tuned mean-abs-error (in reps) per exercise, picks the
   thresholds that minimize error, and derives `max_reps_per_sec` from the
   fastest legit clip (so real fast reps aren't flagged as "sped up").

3. Deploy `calibration.json` next to the worker. `config.py` auto-loads it on
   start (`_apply_calibration`) and overrides the matching profiles — no code
   change. Re-run as you collect more footage.

   - Aim for ≥5 clips per exercise spanning slow/fast cadence and body types.
   - Label `reps` by hand-counting the clip; that's the ground truth.

## Other calibration notes
- Token check covers *shown* tokens; add a `faster-whisper` ASR pass for *spoken*.
- Person-consistency is a within-clip proportion check. Matching against an
  enrolled reference image is stronger but is **biometric data** — see the legal
  notes in `supabase/verification.sql` (BIPA/CCPA/GDPR) before enabling it.
