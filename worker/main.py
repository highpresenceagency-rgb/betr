"""Worker entrypoint.

Two ways work arrives, use either or both:
  • PUSH  — POST /process {"submission_id": "..."} from the `ml-dispatch` edge
            function right after the client uploads a clip (low latency).
  • POLL  — a background loop claims `pending_ml` submissions every few seconds
            (robust; needs no inbound networking). Toggle with ENABLE_POLLER.

Processing is CPU/GPU-heavy, so it runs in a thread pool to keep the event loop
responsive. Idempotent: `process()` no-ops if the submission already left
`pending_ml`, so push + poll racing on the same row is safe.
"""
from __future__ import annotations
import asyncio
import contextlib
from concurrent.futures import ThreadPoolExecutor
from fastapi import FastAPI
from pydantic import BaseModel

import config
import analyze
import supabase_client as sb

app = FastAPI(title="proof-verification-worker")
_pool = ThreadPoolExecutor(max_workers=config.POLL_BATCH)
_inflight: set[str] = set()


class ProcessReq(BaseModel):
    submission_id: str


@app.get("/healthz")
def healthz():
    return {"ok": True, "poller": config.ENABLE_POLLER}


@app.post("/process")
async def process(req: ProcessReq):
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(_pool, analyze.process, req.submission_id)


async def _poller():
    loop = asyncio.get_running_loop()
    while True:
        try:
            pending = await loop.run_in_executor(_pool, sb.fetch_pending, config.POLL_BATCH)
            tasks = []
            for row in pending:
                sid = row["id"]
                if sid in _inflight:
                    continue
                _inflight.add(sid)
                tasks.append(_run(loop, sid))
            if tasks:
                await asyncio.gather(*tasks, return_exceptions=True)
        except Exception as e:  # never let the loop die
            print(f"[poller] error: {e}")
        await asyncio.sleep(config.POLL_INTERVAL_SECONDS)


async def _run(loop, sid: str):
    try:
        await loop.run_in_executor(_pool, analyze.process, sid)
    finally:
        _inflight.discard(sid)


@app.on_event("startup")
async def _startup():
    if config.ENABLE_POLLER:
        app.state.poller = asyncio.create_task(_poller())


@app.on_event("shutdown")
async def _shutdown():
    task = getattr(app.state, "poller", None)
    if task:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task
