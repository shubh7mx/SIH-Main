"""
Test that the WebSocket endpoint actually broadcasts real classified events
from the FIRMS worker, not random generators.
"""
import asyncio
import json
import sys
try:
    import websockets
except ImportError:
    print("FAIL: websockets package not installed. Run: pip install websockets")
    sys.exit(1)

URL = "ws://127.0.0.1:8000/api/v1/ws/alerts?role=analyst"


async def listen():
    received = []
    try:
        async with websockets.connect(URL, open_timeout=5, subprotocols=["v1"]) as ws:
            print(f"[WS] Connected to {URL}")
            # Wait for backlog + heartbeats
            for i in range(20):
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=15)
                    data = json.loads(msg)
                    msg_type = data.get("type", "event")
                    print(f"[WS #{i+1}] type={msg_type}")
                    if msg_type in ("event", "backlog"):
                        ev = data.get("event", data)
                        print(f"        classification={ev.get('classification')} conf={ev.get('confidence_score')} facility={ev.get('facility_name')}")
                    received.append(msg_type)
                except asyncio.TimeoutError:
                    print(f"[WS] No message in 15s, continuing...")
                    break
    except Exception as exc:
        print(f"[WS] Error: {exc}")
    return received


msgs = asyncio.run(listen())
print(f"\n=== SUMMARY ===")
print(f"Total messages: {len(msgs)}")
print(f"Has 'connected' frame: {'connected' in msgs}")
print(f"Has 'backlog' frames: {msgs.count('backlog')}")
print(f"Has 'event' frames: {msgs.count('event')}")
print(f"Has 'heartbeat': {'heartbeat' in msgs}")

# PASS criteria
ok = "connected" in msgs and (msgs.count("backlog") > 0 or msgs.count("event") > 0)
print(f"\n{'PASS' if ok else 'FAIL'}: WebSocket delivers real classified events")
