# Deploying the verification worker

The worker needs a host that can run the `Dockerfile` (GPU recommended for real
throughput). Two low-friction options below — both reuse the existing Dockerfile,
so there's no provider-specific code to maintain. You run these; they need your
hosting account.

Required env vars / secrets on the host:
- `SUPABASE_URL` = https://xzpvnkkghulalkpjusfs.supabase.co
- `SUPABASE_SERVICE_ROLE_KEY` = (Dashboard → Project Settings → API → service_role — **secret**, server-side only)
- optional: `ENABLE_POLLER=true` (default), `POLL_INTERVAL_SECONDS`, `MAX_FRAMES`

After it's up, copy its public URL and set `ML_WORKER_URL` (and optional
`ML_WORKER_TOKEN`) as Supabase **edge-function secrets** so `ml-dispatch` can push
to it. Until then the worker's poller still picks up submissions every few seconds.

## Option A — Fly.io (uses the Dockerfile; supports GPUs)
```bash
cd worker
fly launch --no-deploy            # generates fly.toml from the Dockerfile; pick a name/region
fly secrets set \
  SUPABASE_URL=https://xzpvnkkghulalkpjusfs.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
# For GPU: add to fly.toml →  [[vm]]\n  size = "a10"   (see fly.io/docs/gpus)
fly deploy
fly status                        # note the https URL
```

## Option B — Google Cloud Run (CPU; fine for low volume / rep-counting only)
```bash
cd worker
gcloud run deploy bettrr-worker --source . --region us-west1 --allow-unauthenticated \
  --set-env-vars SUPABASE_URL=https://xzpvnkkghulalkpjusfs.supabase.co \
  --set-env-vars SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
# Cloud Run is CPU-only here; drop easyocr from requirements.txt for speed, or
# use Cloud Run GPU (preview) / GKE for the OCR + pose models.
```

## Then wire dispatch (optional, low-latency)
Supabase Dashboard → Edge Functions → Secrets:
```
ML_WORKER_URL = https://<your-worker-host>
ML_WORKER_TOKEN = <any shared secret>   # optional
```

## Calibrate against real footage (separate, local)
Calibration is a local step you run once you have labeled clips — it does not run
on the deployed worker. See README.md → "Calibrate rep thresholds": drop clips +
`labels.csv` in a folder and run `python calibrate.py --clips ./clips`, then deploy
the resulting `calibration.json` alongside the worker.
