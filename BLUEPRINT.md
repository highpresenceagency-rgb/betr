# Bettrr — Project Blueprint

> A complete description of what Bettrr is, why it works the way it does, and how to
> rebuild it from scratch on any stack. Written so you can recreate the system with
> different tools — the *concepts*, *data model*, and *flows* are the real product;
> the specific tech (Expo/Supabase/Stripe) is just one implementation.

---

## 1. The premise (what it is, in one breath)

**Bettrr is a fitness-challenge betting app.** People put money (as points) on a goal they
choose — *"100 push-ups every day for 30 days"*, *"run a 5K 4× a week"*, *"plank 3 minutes
daily"* — and everyone in a challenge pays the same stake into a shared **pot**. You record a
short **video proof** each day the challenge requires. **Finish the challenge and you split the
pot** with everyone else who finished. **Fall short and your stake stays in the pot for the
people who made it.** Success is measured against *the challenge itself* (did you complete it?),
not against other players — so everyone can win, or everyone can lose; it depends only on who
shows up.

The hard part — and the actual intellectual property — is **trustless proof**: making sure the
video proof is real, current, and actually shows the work, without a human watching every clip.
That's the *verification funnel* (Section 4).

### What makes it different from a generic habit/bet app
- **Any goal**, not a fixed catalog. The challenge text + a few config fields define it.
- **Completion-based payout**, not ranked/leaderboard. You win by finishing, full stop.
- **Proof is in-app video only** — never an upload from the camera roll — with a **daily
  rotating anti-replay token** shown on screen while you record, so old/downloaded clips can't
  be reused.
- **Layered verification**: AI screens every clip, a small peer group can flag, and disputed
  clips go to *neutral* reviewers who don't know you. Honest flaggers gain reputation; abusers
  get down-weighted.

---

## 2. The money model

- Users hold a **points balance** in a wallet. Points can be topped up (deposit) and, where
  legally allowed, cashed out (withdraw).
- Joining a challenge **locks** your stake (`bet_amount`) out of your available balance into a
  `locked_balance` until the challenge ends.
- The **pot** = sum of all participants' stakes. An optional **creator fee** (0–10%, public
  challenges only, shown before you join) is skimmed; the rest is split evenly among finishers.
- **Settlement is completion-based and atomic**: when a challenge ends, the system determines
  who met the target within the allowed misses, releases/forfeits locked funds, and pays
  winners their share — all in one transaction. Payout math is **server-side only**, never
  computed on the client.

### ⚖️ Legal flags — do NOT solve these in code; get a lawyer
Anything below is a question for counsel, not engineering. Flag every one before launch:
- Is staking points on a self-set goal **gambling / a wager** in each target jurisdiction?
  (Skill-vs-chance classification varies by state/country.)
- **Money transmission / KYC / AML** obligations for holding balances and paying out.
- Whether **points are purchasable and/or cashable**, and where — this changes the legal
  category entirely.
- **Tax reporting** on winnings; **escheatment** of dormant balances.
- **Refunds / disputes / chargebacks** policy and Stripe's rules.
- Terms of Service & Privacy Policy (you collect biometric-adjacent data: workout videos +
  pose estimation).
The app's user-facing copy is deliberately written **without** making legal claims (e.g. the
FAQ never asserts "this isn't gambling").

---

## 3. System architecture (three programs)

```
┌─────────────────────────┐     ┌──────────────────────────────┐     ┌────────────────────────┐
│  MOBILE APP (client)     │     │  BACKEND (Postgres + funcs)   │     │  ML WORKER (GPU)        │
│  - browse / join         │◄───►│  - data + RLS                 │◄───►│  - pose estimation      │
│  - record proof video    │     │  - business logic (RPCs)      │     │  - rep counting         │
│  - flag peers            │     │  - edge functions (HTTP)      │     │  - anti-cheat signals   │
│  - review queue          │     │  - cron (lifecycle)           │     │  - reads/writes proof   │
│  - wallet                │     │  - storage (private videos)   │     │    + submission rows    │
└─────────────────────────┘     └──────────────────────────────┘     └────────────────────────┘
```

1. **Mobile app** — what the user touches. Thin: it calls backend functions; it does *not*
   contain business logic or payout math.
2. **Backend** — the source of truth. A relational DB with **row-level security**, business
   logic in stored procedures (RPCs), HTTP **edge functions** for anything needing secrets
   (payments, signed URLs, kicking the ML worker), and a **cron** that drives the challenge
   lifecycle.
3. **ML worker** — a separate service (needs a GPU) that watches for new proof videos, runs
   pose estimation + OCR + anti-cheat heuristics, and writes back a rep count + suspicion score.

**Reference implementation:** Expo/React Native app · Supabase (Postgres, Auth, Storage, Deno
edge functions, pg_cron) · Stripe (payments) · Python/FastAPI worker (MediaPipe + EasyOCR),
deployed on a GPU host (Fly/Cloud Run/Modal). Swap any layer — the contracts below are what
matter.

---

## 4. The verification funnel (the core IP)

A clip flows through up to four layers. Most legit clips stop at layer 1.

```
        record in-app  ─────────────►  submission (status: pending_ml)
                                              │
   ┌──────────────────────────────────────────┘
   ▼
 (1) AI QUICK-PASS  ── pose rep-count + suspicion score 0..1 + token detected?
        │  clean & on-target  ────────────────────────────►  auto_approved
        │  borderline / suspicious
        ▼
 (2) ACCOUNTABILITY GROUP  ── 4–10 peers in the same challenge see each other's clips,
        │                     can one-tap flag with a structured reason
        │  no flags (or only low-weight flags)  ───────────►  approved
        │  credible flag(s)
        ▼
 (3) NEUTRAL BINDING REVIEW  ── routed to reviewers who are NOT in your group
        │                       (paid reviewers or cross-challenge users); their
        │                       majority decision is final
        │  ───────────────────────────────────────────────►  approved / rejected
        ▼
 (4) FLAGGER REPUTATION  ── after a review resolves, update each flagger's reputation:
                            upheld flag → weight up; bad flag → weight down. Low-weight
                            flags need more corroboration to escalate. (anti-abuse)
```

### Anti-replay token
Each live challenge has a **daily rotating token** (a short word/code). It is only readable
on/after its day (enforced by DB policy) and is shown on screen *while recording*. The clip
must contain the token (spoken or visible) → checked by OCR in layer 1. This defeats reusing
yesterday's clip or a downloaded video.

### Why "neutral" matters
Reviewers are drawn so they're **never in the same accountability group** as the person being
reviewed — removing the incentive to collude or retaliate. Reviewer pool = paid reviewers
and/or users pulled from *other* challenges.

### Submission status machine
`pending_ml → auto_approved` · `pending_ml → in_review → approved | rejected` ·
plus `expired` / `missed` (no clip submitted in time).

---

## 5. Data model

17 tables. Group them by concern. (Types shown are conceptual; use whatever your DB offers.)

### Identity & money
| Table | Purpose | Key fields |
|---|---|---|
| `profiles` | one per user (1:1 with auth user) | `id`, `username`, `name`, `initials` |
| `wallets` | balance per user | `user_id`, `balance`, `locked_balance` |
| `transactions` | ledger of money movements | `user_id`, `type` (deposit/withdrawal/challenge_join/win/refund), `amount`, `description` |
| `withdrawal_requests` | cash-out requests | `user_id`, `amount`, `status` |
| `points_ledger` | points accounting entries | `user_id`, … |

### Social
| Table | Purpose | Key fields |
|---|---|---|
| `friendships` | friend graph | `requester_id`, `addressee_id`, `status` (pending/accepted) |

### Challenges
| Table | Purpose | Key fields |
|---|---|---|
| `challenges` | the game | `creator_id`, `goal`, `type` (public/private), `bet_amount`, `duration_days`, `starts_at`, `ends_at`, `status` (pending/live/voting/completed/cancelled), `creator_fee_percent`, `creator_participates`, `participant_count`, `pot`, `cadence` (daily/once), `target_reps`, `required_count`, `allowed_misses` |
| `challenge_participants` | who's in | `challenge_id`, `user_id`, `status` (active/won/eliminated) |
| `votes` | (legacy/simple peer voting path) | `challenge_id`, `voter_id`, `target_id`, `passed` |

### Verification funnel
| Table | Purpose | Key fields |
|---|---|---|
| `daily_tokens` | per-challenge per-day anti-replay code | `challenge_id`, `token_date`, `token_text` |
| `submissions` | one proof attempt | `challenge_id`, `user_id`, `group_id`, `proof_date`, `status`, `ml_rep_count`, `ml_target`, `ml_suspicion`, `ml_signals`, `token_detected`, `video_path` |
| `accountability_groups` | the 4–10 person pods | `challenge_id`, … |
| `group_members` | pod membership | `group_id`, `challenge_id`, `user_id` |
| `submission_flags` | one-tap flags on a clip | `submission_id`, `flagger_id`, `reason` (sped_up/cant_see_full_reps/possibly_reused/not_same_person/other), `note` |
| `reviewer_assignments` | who must review what | `submission_id`, `reviewer_id`, `kind` (paid/cross_challenge), `status`, `due_at` |
| `reviews` | a reviewer's binding decision | `submission_id`, `reviewer_id`, `decision` (approved/rejected), `reason` |
| `flagger_reputation` | anti-abuse weighting | `user_id`, `weight`, `flags_upheld`, `flags_total` |

**Relationships that bite you:** the embed-friendly FKs (`challenges.creator_id`,
`challenge_participants.user_id`, `friendships.requester_id/addressee_id`,
`submissions.user_id`) should reference the **profiles** table (which itself references the auth
user) so the API can join profile data in one query. If they point only at the auth user, your
ORM/REST layer can't resolve `challenge → creator profile` embeds.

**RLS recursion trap:** "challenge is visible if you're a participant" + "participant rows are
visible if you can see the challenge" → two policies that reference each other's table cause
infinite recursion. Break it with `SECURITY DEFINER` helper functions (e.g. `is_member()`,
`can_see_challenge()`) that read past RLS so the policies don't call back into each other.

---

## 6. Key flows (step by step)

### A. Onboard
Sign up (4 short steps) → a trigger auto-creates a `profiles` row + a zero-balance `wallets`
row. Guest/read-only mode is allowed for browsing; any write action is gated behind "create an
account."

### B. Create a challenge ("host your own game")
Creator sets: goal text, public/private, stake amount, duration, start date, whether they
participate, creator fee (public only), and verification config (cadence, target reps, required
count, allowed misses). If the creator participates, they immediately join (and their stake
locks) — with rollback if the join fails.

### C. Join
Atomic RPC: verify the challenge is open → check available balance ≥ stake → move stake from
`balance` to `locked_balance` → insert participant → bump `participant_count` and `pot`. All or
nothing.

### D. Record daily proof
1. App fetches **today's token** for the challenge (only readable on/after its day).
2. User records **in the app** (no gallery upload), token shown on screen.
3. App uploads the clip to **private storage** at path `{challengeId}/{userId}/{timestamp}.ext`
   (storage RLS allows writing only to your own `{userId}` folder).
4. App calls an RPC to create the `submission` row (`pending_ml`) and fires a best-effort
   "kick" to the ML worker (a poller is the fallback if the kick is missed).

### E. AI quick-pass (ML worker)
Worker picks up the submission → downloads the clip via a short-lived signed URL → runs pose
estimation to **count reps**, OCR to **detect the token**, and heuristics for a **suspicion
score 0..1** → writes back `ml_rep_count`, `ml_suspicion`, `ml_signals`, `token_detected` and
sets status to `auto_approved` (clean) or `in_review` (borderline).

### F. Group flag → neutral review
Peers in your accountability group can view your clips (RLS-gated) and one-tap flag with a
reason. Credible flags (weighted by flagger reputation) escalate the submission to
`reviewer_assignments` for **neutral** reviewers. Their majority `reviews.decision` is binding.

### G. Lifecycle cron (every ~5 min)
A scheduled job advances state: `pending → live` at `starts_at`; seeds the day's token; forms
accountability groups; escalates overdue reviews; `live → voting` at `ends_at`; and triggers
**settlement** when reviews are done.

### H. Settlement & payout
Server determines who **completed** (approved days ≥ `required_count − allowed_misses`), then
atomically: forfeit losers' locked stakes into the pot, skim creator fee, **split the pot evenly
among finishers**, release/credit balances, write `transactions`, mark participants
won/eliminated, set challenge `completed`. Never done client-side.

### I. Watch a proof (reviewers/peers)
Videos live in a **private** bucket. The client never builds a public URL — it calls an edge
function that checks the caller's right to see that clip (RLS) and returns a **short-lived
signed URL** (≈2 min).

---

## 7. Backend functions

### Stored procedures (RPCs) — business logic next to the data
`join_challenge`, `create_submission`, `submit_flag`, `submit_review`, `settle_challenge`,
`get_profile_stats`, wallet mutators (`increment_wallet`, `forfeit_locked`, `release_locked`,
`request_withdrawal`). **Money/admin RPCs are locked down** — revoked from PUBLIC/anon/auth and
granted only to the service role; only genuinely user-callable ones (join, submit proof, flag,
review) are granted to authenticated users.

### Edge functions (HTTP, hold secrets) — 7 of them
| Function | Job |
|---|---|
| `create-deposit` | start a Stripe Checkout session for a top-up |
| `create-withdrawal` | submit a cash-out request |
| `stripe-webhook` | credit the wallet when Stripe confirms payment |
| `process-payout` | atomic settlement of a finished challenge |
| `challenge-lifecycle` | the ~5-min cron: state transitions, token rotation, group forming, review escalation, settlement |
| `ml-dispatch` | fire-and-forget kick to the ML worker for a new submission |
| `get-proof-url` | RLS-checked, short-lived signed URL for a proof video |

---

## 8. The ML worker

Python/FastAPI service, GPU-backed. Modules:
- `main.py` — FastAPI `/process` endpoint **and** a background poller (so it works even if the
  HTTP kick is dropped).
- `pose.py` — pose estimation (MediaPipe) → keypoints per frame.
- `analyze.py` — turns keypoints into **rep counts** using hysteresis (count a rep only after
  the joint angle crosses down then back up past thresholds — avoids double-counting jitter).
- `signals.py` — anti-cheat **suspicion signals**: playback-speed anomalies, can't-see-full-reps,
  identity continuity, token presence (OCR), etc., combined into a 0..1 score.
- `config.py` — per-exercise profiles (which joints/angles define a "rep" for push-ups vs squats
  vs planks…).
- `calibrate.py` → `calibration.json` — tune thresholds from labeled sample clips.
- `supabase_client.py` — pull pending submissions, download via signed URL, write results back.

**Contract with the backend:** input = a submission id + signed video URL; output = write
`ml_rep_count`, `ml_target`, `ml_suspicion` (0..1), `ml_signals` (json), `token_detected`
(bool), and set the submission to `auto_approved` or `in_review`.

---

## 9. Theme system (if you want the same switchable look)

Two independent dimensions: **mode** (light / dark) × **accent** (5 hues: Tidal blue, Matrix
green, Nebula purple, Ember orange, Coral). A palette is *computed* from `(mode, accent)` — base
neutrals per mode, accent tints blended on the fly — and exposed through context so flipping
either dimension re-skins the whole app live. Both choices persist to local storage. **Default
is light + Tidal.** Lesson learned: never hardcode hex in screens; always pull from the palette,
or light mode silently renders dark-on-dark.

---

## 10. How to rebuild it (stack-agnostic, phased)

Build **backend-first**; cosmetic screens last. Each phase is independently testable.

**Phase 0 — pick your stack.** You need: (a) a relational DB with row-level security and stored
procedures, (b) auth, (c) private file storage with signed URLs, (d) serverless functions for
secrets, (e) a scheduler/cron, (f) a payments provider, (g) a GPU host for the ML worker, (h) a
mobile app framework with a camera.

**Phase 1 — data model + security.** Create the 17 tables (Section 5). Turn on RLS. Write the
`SECURITY DEFINER` visibility helpers to avoid the recursion trap. Make the profile-embed FKs.
Auto-create profile+wallet on signup.

**Phase 2 — money rails.** Wallet + transactions. `join_challenge` (atomic lock). Deposit
(checkout + webhook → credit). Withdrawal request. Lock down money RPCs to the service role.

**Phase 3 — verification funnel (the actual product).** Submissions + statuses. Daily token
generation + day-gated read policy. In-app recording → private upload (`{challengeId}/{userId}/…`)
→ create submission. Signed-URL function for playback. Accountability groups + membership.
One-tap flags. Neutral reviewer assignment + binding reviews. Flagger reputation update on
resolve. **Get this working with fake/stub ML first** (status `pending_ml` → manually approve).

**Phase 4 — ML worker.** Pose → rep count (hysteresis) → suspicion signals → write back. Poller
+ HTTP kick. Per-exercise config + calibration. Now auto-approve clean clips.

**Phase 5 — lifecycle + settlement.** Cron: state transitions, token rotation, group forming,
review escalation. Atomic completion-based `settle_challenge` + payout. Never on the client.

**Phase 6 — the app screens.** Welcome/onboarding · discover feed · challenge detail (pot / bet /
join) · host-your-own (create) · daily check-in/record · group feed + flag · review queue ·
wallet (deposit/withdraw/history) · friends · profile · settings (theme) · FAQ. Theme system.
Guest mode.

**Phase 7 — before launch.** Lawyer review of every item in Section 2. Real device builds.
Calibrate the ML on real clips. Load/abuse-test the flag→review→reputation loop.

---

## 11. Hard-won gotchas (don't relearn these)
- **RLS recursion** between challenges ↔ participants → use `SECURITY DEFINER` helpers.
- **API embeds** need FKs pointing at the *profile* table, not just the auth user.
- **Money functions** inherit PUBLIC grants — explicitly revoke from PUBLIC *and* anon *and*
  authenticated, then re-grant only the user-callable ones.
- **Never** build public URLs for proof videos; mint short-lived signed URLs through an
  RLS-checked function.
- **Settlement is server-side and atomic** — don't reimplement payout math in the client.
- **No hardcoded colors** in UI — drive everything from the theme palette so light/dark both
  work.
- The ML "kick" is best-effort; always have a **poller** so nothing stalls if the kick is lost.

---

*This blueprint describes the system, not a specific codebase. Recreate it on any stack by
honoring the data model (Section 5), the verification funnel (Section 4), and the flows
(Section 6). The legal items in Section 2 are non-negotiable pre-launch homework.*
