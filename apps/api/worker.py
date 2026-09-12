"""
Background FIRMS Worker (Smart Backfilling & Adaptive Cost-Saving Poller)
=========================================================================
Runs the FIRMS poller + agent swarm pipeline as an async background task.
Handles:
  - Startup recovery & automated backfill for server downtime
  - Dynamic adaptive polling intervals (Day Peak 5m vs Night Economy 15m)
  - Persistent state checkpoints to save EC2 CPU/network cycles
  - Graceful shutdown with in-flight drain
"""

import asyncio
import time
import sys
from typing import Callable, Awaitable, Optional

sys.path.insert(0, ".")

from packages.ingestion.src.firms_poller import FIRMSPoller
from packages.agents.src.graph import run_swarm
from apps.api.core.log_store import log_store
from apps.api.core.recovery import recovery_manager


class FIRMSWorker:
    """
    Smart background worker that polls NASA FIRMS, handles downtime backfilling,
    adapts polling frequencies to save cloud costs, and routes hotspots through
    the multi-agent swarm.
    """

    def __init__(
        self,
        poll_interval: int = 300,
        batch_size: int = 100,
        on_event: Optional[Callable[[dict], Awaitable[None]]] = None,
    ):
        self.poll_interval = poll_interval
        self.batch_size = batch_size
        self.on_event = on_event
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._stop_event = asyncio.Event()
        self._total_processed = 0
        self._total_polls = 0

        self.poller = FIRMSPoller(poll_interval_seconds=poll_interval)

    @property
    def is_running(self) -> bool:
        return self._running

    async def start(self):
        """Starts the worker as a background task and executes startup recovery."""
        if self._running:
            return
        self._running = True
        self._stop_event.clear()

        # 1. Execute Startup Downtime Assessment
        startup_info = recovery_manager.on_startup()
        downtime_sec = startup_info.get("downtime_seconds", 0)
        restarts = startup_info.get("total_restarts", 1)

        if downtime_sec > 0:
            await log_store.add(
                "INFO",
                "RECOVERY_MANAGER",
                f"Server restart #{restarts} detected. Estimated downtime: {startup_info['downtime_human']}",
                metadata=startup_info,
            )

        # 2. Spawn polling & backfill loop
        self._task = asyncio.create_task(self._run_loop(startup_info))
        await log_store.add("INFO", "FIRMS_POLLER", "NASA FIRMS smart adaptive poller initialized")

    async def stop(self):
        """Signals the worker to stop gracefully."""
        if not self._running:
            return
        self._running = False
        self._stop_event.set()
        if self._task:
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        recovery_manager.save_state()
        await log_store.add(
            "INFO",
            "FIRMS_POLLER",
            f"FIRMS worker stopped — processed {self._total_processed} events in {self._total_polls} polls",
        )

    async def _run_loop(self, startup_info: dict):
        """Main polling loop with initial backfill."""
        poll_count = 0

        # Run initial backfill if downtime occurred
        if startup_info.get("backfill_needed"):
            day_range = startup_info.get("day_range", 1)
            await log_store.add(
                "INFO",
                "BACKFILL_AGENT",
                f"Executing automated backfill for {day_range}-day downtime gap...",
                metadata={"day_range": day_range},
            )
            try:
                backfill_hotspots = await self.poller.fetch_live_firms(day_range=day_range)
                if backfill_hotspots:
                    processed_backfill = 0
                    for hotspot in backfill_hotspots[: self.batch_size * 2]:
                        try:
                            result = run_swarm(hotspot)
                            self._total_processed += 1
                            processed_backfill += 1
                            if self.on_event:
                                await self.on_event(result)
                        except Exception as exc:
                            print(f"[Backfill] Error: {exc}")
                    recovery_manager.record_backfill_complete(processed_backfill)
                    await log_store.add(
                        "INFO",
                        "BACKFILL_AGENT",
                        f"Backfill complete: Ingested & classified {processed_backfill} thermal anomalies missed during downtime.",
                    )
            except Exception as exc:
                await log_store.add("ERROR", "BACKFILL_AGENT", f"Backfill error: {exc}")

        while self._running and not self._stop_event.is_set():
            poll_count += 1
            self._total_polls += 1
            start_time = time.monotonic()

            # Adaptive dynamic interval to minimize EC2 compute/network usage
            current_interval = recovery_manager.get_adaptive_poll_interval()

            try:
                # 1. Poll FIRMS
                await log_store.add(
                    "INFO",
                    "FIRMS_POLLER",
                    f"Initiating FIRMS cycle #{poll_count} ({recovery_manager._state.get('adaptive_mode')})...",
                )
                hotspots = await self.poller.fetch_live_firms(day_range=1)

                if not hotspots:
                    await log_store.add(
                        "INFO",
                        "FIRMS_POLLER",
                        f"Cycle #{poll_count}: No new thermal anomalies detected.",
                    )
                else:
                    batch = hotspots[: self.batch_size]
                    await log_store.add(
                        "INFO",
                        "INGESTION",
                        f"Ingested {len(batch)} thermal hotspots from NASA FIRMS (VIIRS 375m / MODIS 1km)",
                        metadata={"hotspot_count": len(batch), "poll_id": poll_count},
                    )

                    critical_count = 0
                    latest_acq = None
                    for hotspot in batch:
                        try:
                            result = run_swarm(hotspot)
                            self._total_processed += 1
                            if result.get("is_critical_alert"):
                                critical_count += 1
                            if result.get("acq_datetime"):
                                latest_acq = result["acq_datetime"]

                            if self.on_event:
                                await self.on_event(result)

                        except Exception as exc:
                            await log_store.add(
                                "ERROR",
                                "ORCHESTRATOR",
                                f"Agent swarm error on hotspot {hotspot.get('firms_id', '?')}: {exc}",
                                event_id=hotspot.get("firms_id"),
                            )

                    recovery_manager.record_activity(latest_event_acq=latest_acq)
                    elapsed = time.monotonic() - start_time
                    await log_store.add(
                        "INFO",
                        "ORCHESTRATOR",
                        f"Swarm cycle completed: {len(batch)} events processed in {elapsed:.2f}s ({critical_count} critical alerts gated)",
                        metadata={"batch_size": len(batch), "elapsed_seconds": round(elapsed, 2), "critical_count": critical_count},
                    )

            except Exception as exc:
                await log_store.add(
                    "ERROR",
                    "FIRMS_POLLER",
                    f"Poll #{poll_count} failed: {exc}",
                )

            # Wait for adaptive interval or stop event
            try:
                await asyncio.wait_for(
                    self._stop_event.wait(),
                    timeout=float(current_interval),
                )
            except asyncio.TimeoutError:
                pass


_global_worker: Optional[FIRMSWorker] = None


async def start_worker(on_event_callback=None) -> FIRMSWorker:
    """Entry point called during FastAPI lifespan startup."""
    global _global_worker
    if _global_worker is None or not _global_worker.is_running:
        _global_worker = FIRMSWorker(
            poll_interval=300,
            batch_size=100,
            on_event=on_event_callback,
        )
        await _global_worker.start()
    return _global_worker


async def stop_worker():
    """Entry point called during FastAPI lifespan shutdown."""
    global _global_worker
    if _global_worker and _global_worker.is_running:
        await _global_worker.stop()
        _global_worker = None


def get_worker_stats() -> dict:
    """Returns current worker runtime telemetry."""
    if _global_worker is None:
        return {"running": False, "total_processed": 0, "total_polls": 0}
    return {
        "running": _global_worker.is_running,
        "total_processed": _global_worker._total_processed,
        "total_polls": _global_worker._total_polls,
    }
