# Bettr (bettrr)

Fitness-challenge betting app. Users deposit money to join time-bound challenges (e.g. "100 push-ups daily for 30 days"), record daily proof videos, and split the pot: completers win, non-completers forfeit their stake to the winners. Proof videos are auto-verified by an ML service (pose estimation + an anti-replay token spoken/shown on camera); borderline cases go to neutral human reviewers drawn from other challenges.

## Stack

- **App**: Expo (~54) + React Native (0.81, new architecture) + expo-router (file-based routing), TypeScript strict. Entry: `expo-router/entry`.
- **Backend**: Supabase — Postgres (RLS-heavy), Auth, Storage (private `proofs` bucket), Deno edge functions.
- **ML worker**: Python / FastAPI (`worker/`), MediaPipe pose + EasyOCR. Deployed separately (Docker → Cloud Run/Fly/Modal).
- **Payments**: Stripe (deposit/withdrawal edge functions + webhook).

## Commands

```bash
npm start          # expo start (dev)
npm run ios        # / android / web
```

No test or lint script is configured. EAS handles builds/deploys (`eas.json`); placeholder IDs in `app.json`/`eas.json` must be filled before real builds.

## Layout

- `app/` — routes. `(auth)/` = sign-in + 4-step sign-up; `(home)/` = tabs (index, `challenges/`, `friends/`, `wallet/`, `profile/`); modal routes `check-in.tsx`, `proof.tsx`; `deposit-success/cancel.tsx` are Stripe redirect targets.
- `lib/api.ts` — **the API layer**. All domain reads/writes + exported domain types (`Profile`, `Wallet`, `Challenge`, `Submission`, etc.) live here; treat these types as the source of truth.
- `lib/supabase.ts` — client; reads `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`; AsyncStorage session persistence; degrades gracefully if env is missing.
- `lib/guest.ts` — guest (read-only) mode. Gate write actions with `guardGuest(...)`.
- `lib/theme.tsx` — runtime theme `ThemeProvider` + `useTheme()` + `makeStyles()`; palette persisted to AsyncStorage.
- `constants/theme.ts` — static `palettes` (5 schemes), `radii`, `spacing`.
- `components/` — shared UI (Button, Input, ProgressBar, …).
- `supabase/functions/` — `challenge-lifecycle` (5-min cron: state transitions, token rotation, review escalation, settlement), `process-payout` (atomic settle), `get-proof-url` (2-min signed proof URL, RLS-gated), `ml-dispatch` (fire-and-forget kick to ML worker), plus Stripe functions.
- `supabase/*.sql` — schema + logic. **Note (2026-06):** working tree has overlapping/untracked SQL (`all.sql`, `verification.sql`, `verification_logic.sql`, `settlement.sql`); confirm which file is canonical before editing schema.
- `worker/` — Python ML service: `main.py` (FastAPI `/process` + poller), `analyze.py`/`pose.py`/`signals.py` (rep counting, token OCR, anti-cheat), `config.py` (per-exercise profiles), `calibrate.py` → `calibration.json`.

## Conventions & gotchas

- **All business logic flows through Postgres RPCs + edge functions** — no third-party API clients beyond Supabase/Stripe. Prefer adding a function in `lib/api.ts` over calling the client inline in screens.
- Theme-aware styles use `makeStyles()`, not raw `StyleSheet.create` with hardcoded colors.
- Storage proof paths: `{challengeId}/{userId}/{timestamp}.{ext}`; bucket is private — never build public URLs, mint signed ones via `get-proof-url`.
- Settlement is **completion-based** (met target within `allowed_misses`), not ranked; logic is atomic in `settlement.sql` / `settle_challenge()`. Don't reimplement payout math client-side.
- This repo's Supabase project is reachable via the Supabase MCP tools — use `list_tables`/`get_logs`/`get_advisors` before schema changes.
