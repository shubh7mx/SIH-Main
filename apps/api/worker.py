"""
Background FIRMS Worker
======================
Runs the FIRMS poller + agent swarm pipeline as an async background task.
Each detected hotspot flows through the 6-agent swarm and produces a
classified event that is pushed to the FastAPI event store via the callback.
"""

import asyncio
import time
import sys
from typing import Callable, Awaitable, Optional

sys.path.insert(0, ".")

from packages.ingestion.src.firms_poller import FIRMSPoller
from packages.agents.src.graph import run_swarm
from apps.api.core.log_store import log_store


class FIRMSWorker:
    """
    Background worker that polls NASA FIRMS and processes each hotspot
    through the SIH26162 multi-agent swarm.

    Lifecycle:
      start() → runs polling loop until stop() is called
      Each poll: fetch → dedup → swarm → callback(event)
    """

    def __init__(
        self,
        poll_interval: int = 600,  # 10 minutes between polls
        batch_size: int = 100,     # Max events to process per poll
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

        # Initialize FIRMS poller
        self.poller = FIRMSPoller(poll_interval_seconds=poll_interval)

    @property
    def is_running(self) -> bool:
        return self._running

    async def start(self):
        """Starts the worker as a background task."""
        if self._running:
            return
        self._running = True
        self._stop_event.clear()
        self._task = asyncio.create_task(self._run_loop())
        await log_store.add("INFO", "FIRMS_POLLER", "NASA FIRMS poller started for India BBox (6,68,38,98)")

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
        await log_store.add(
            "INFO",
            "FIRMS_POLLER",
            f"FIRMS worker stopped — processed {self._total_processed} events in {self._total_polls} polls",
        )

    async def _run_loop(self):
        """Main polling loop."""
        poll_count = 0
        while self._running and not self._stop_event.is_set():
            poll_count += 1
            self._total_polls += 1
            start_time = time.monotonic()

            try:
                # 1. Poll FIRMS
                await log_store.add(
                    "INFO",
                    "FIRMS_POLLER",
                    f"Initiating FIRMS poll #{poll_count} across India bounding box...",
                )
                hotspots = await self.poller.fetch_live_firms(day_range=1)

                if not hotspots:
                    await log_store.add(
                        "INFO",
                        "FIRMS_POLLER",
                        f"Poll #{poll_count}: No new thermal anomalies detected in this cycle.",
                    )
                else:
                    # 2. Limit batch size
                    batch = hotspots[: self.batch_size]
                    await log_store.add(
                        "INFO",
                        "INGESTION",
                        f"Poll #{poll_count}: Ingested {len(hotspots)} hotspots. Routing batch of {len(batch)} to 6-agent swarm.",
                    )

                    # 3. Process each through the agent swarm
                    critical_count = 0
                    for hotspot in batch:
                        try:
                            result = run_swarm(hotspot)
                            self._total_processed += 1
                            if result.get("is_critical_alert"):
                                critical_count += 1

                            # 4. Invoke callback (pushes to event store + WebSocket + logs)
                            if self.on_event:
                                await self.on_event(result)

                        except Exception as exc:
                            await log_store.add(
                                "ERROR",
                                "ORCHESTRATOR",
                                f"Agent swarm error on hotspot {hotspot.get('firms_id', '?')}: {exc}",
                                event_id=hotspot.get("firms_id"),
                            )

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

            # Wait for next poll or stop signal
            try:
                await asyncio.wait_for(
                    self._stop_event.wait(),
                    timeout=self.poll_interval,
                )
            except asyncio.TimeoutError:
                pass

    def get_stats(self) -> dict:
        return {
            "running": self._running,
            "total_processed": self._total_processed,
            "total_polls": self._total_polls,
            "poll_interval_seconds": self.poll_interval,
        }


# Global worker instance
_worker_instance: Optional[FIRMSWorker] = None


def get_worker_stats() -> dict:
    if _worker_instance:
        return _worker_instance.get_stats()
    return {"running": False, "total_processed": 0, "total_polls": 0}


async def start_worker(on_event_callback=None) -> FIRMSWorker:
    global _worker_instance
    if _worker_instance is None:
        _worker_instance = FIRMSWorker(
            poll_interval=600,
            batch_size=100,
            on_event=on_event_callback,
        )
    await _worker_instance.start()
    return _worker_instance


async def stop_worker():
    global _worker_instance
    if _worker_instance:
        await _worker_instance.stop()
