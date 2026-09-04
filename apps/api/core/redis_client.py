"""
Redis Client & Rate Limiter
============================
Async Redis 7.4 client providing:
  - WebSocket connection registry (for fanout)
  - Per-IP rate limiting (sliding window)
  - Hotspot dedup cache (24h TTL)
  - Event publish/subscribe for cross-process fanout
"""

from __future__ import annotations
import os
import time
import json
import asyncio
from typing import Optional, Set
from contextlib import asynccontextmanager

try:
    import redis.asyncio as aioredis
    from redis.asyncio.connection import ConnectionPool
    _REDIS_AVAILABLE = True
except ImportError:
    _REDIS_AVAILABLE = False
    aioredis = None
    ConnectionPool = None



class RedisManager:
    """
    Production Redis manager for SIH26162.
    Single connection pool reused across requests.
    """

    def __init__(self, url: Optional[str] = None):
        self.url = url or os.getenv("REDIS_URL", "redis://localhost:6379/0")
        self.pool: Optional[ConnectionPool] = None
        self.client: Optional[aioredis.Redis] = None
        self._connected = False

    async def connect(self):
        if self._connected:
            return
        if not _REDIS_AVAILABLE:
            print(f"[Redis] redis package not installed — offline mode")
            self._connected = False
            self.client = None
            return
        try:
            self.pool = ConnectionPool.from_url(
                self.url, max_connections=20, decode_responses=True
            )
            self.client = aioredis.Redis(connection_pool=self.pool)
            await self.client.ping()
            self._connected = True
            print(f"[Redis] Connected to {self.url}")
        except Exception as e:
            print(f"[Redis] Connection failed ({e}) — operating in offline mode")
            self._connected = False
            self.client = None

    async def disconnect(self):
        if self.client:
            await self.client.close()
        if self.pool:
            await self.pool.disconnect()
        self._connected = False

    @property
    def available(self) -> bool:
        return self._connected and self.client is not None

    # ── Hotspot deduplication ────────────────────────────────────────────
    async def mark_hotspot(self, firms_id: str, ttl_seconds: int = 86400) -> bool:
        """
        Mark a hotspot as seen. Returns True if it was new (not seen before).
        """
        if not self.available:
            return True  # Offline: allow through
        key = f"firms:seen:{firms_id}"
        result = await self.client.setnx(key, str(time.time()))
        if result:
            await self.client.expire(key, ttl_seconds)
            return True
        return False

    # ── Rate limiting (sliding window) ───────────────────────────────────
    async def check_rate_limit(
        self, key: str, max_requests: int = 60, window_seconds: int = 60
    ) -> bool:
        """
        Sliding-window rate limit. Returns True if request is allowed.
        """
        if not self.available:
            return True
        now = time.time()
        window_start = now - window_seconds
        redis_key = f"rate:{key}"

        # Remove old entries, add new
        await self.client.zremrangebyscore(redis_key, 0, window_start)
        current_count = await self.client.zcard(redis_key)
        if current_count >= max_requests:
            return False
        await self.client.zadd(redis_key, {str(now): now})
        await self.client.expire(redis_key, window_seconds + 5)
        return True

    # ── WebSocket fanout (pub/sub) ───────────────────────────────────────
    async def publish_event(self, channel_or_event, event: Optional[dict] = None):
        if not self.available:
            return
        # Support both publish_event(event) and publish_event(channel, event)
        if event is None and isinstance(channel_or_event, dict):
            target_channel = "events"
            target_event = channel_or_event
        else:
            target_channel = str(channel_or_event)
            target_event = event or {}
        try:
            await self.client.publish(target_channel, json.dumps(target_event, default=str))
        except Exception:
            pass

    async def subscribe_events(self, channel: str):
        """Yields events from a Redis pub/sub channel."""
        if not self.available:
            return
        pubsub = self.client.pubsub()
        await pubsub.subscribe(channel)
        try:
            async for message in pubsub.listen():
                if message.get("type") == "message":
                    yield json.loads(message["data"])
        finally:
            await pubsub.unsubscribe(channel)
            await pubsub.close()


# Global singleton
_redis_manager: Optional[RedisManager] = None


async def get_redis() -> RedisManager:
    global _redis_manager
    if _redis_manager is None:
        _redis_manager = RedisManager()
        await _redis_manager.connect()
    return _redis_manager
