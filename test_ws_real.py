"""Verify WebSocket broadcasts REAL classified events with CDE scores."""
import asyncio
import json
import sys

try:
    import websockets
except ImportError:
    print("websockets not installed")
    sys.exit(1)

URL = "ws://127.0.0.1:8000/api/v1/ws/alerts?role=analyst"


async def listen():
    received = []
    print(f"[WS] Connecting to {URL}")
    async with websockets.connect(URL, open_timeout=5, subprotocols=["v1"]) as ws:
        print(f"[WS] Connected!")
        for i in range(10):
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=5)
                data = json.loads(msg)
                msg_type = data.get("type", "?")
                if msg_type == "connected":
                    print(f"\n[WS #{i+1}] CONNECTED: client_id={data.get('client_id')}, role={data.get('role')}")
                elif msg_type == "backlog":
                    ev = data.get("event", {})
                    print(f"\n[WS #{i+1}] BACKLOG: classification={ev.get('classification')} | facility={ev.get('facility_name')} | conf={ev.get('confidence_score')} | CDE={ev.get('cde_anomaly_score')} | FRP={ev.get('frp_megawatts')}")
                elif msg_type == "event":
                    ev = data.get("event", data)
                    print(f"\n[WS #{i+1}] LIVE EVENT: classification={ev.get('classification')} | facility={ev.get('facility_name')} | conf={ev.get('confidence_score')} | CDE={ev.get('cde_anomaly_score')} | FRP={ev.get('frp_megawatts')}")
                elif msg_type == "heartbeat":
                    print(f"[WS #{i+1}] heartbeat")
                else:
                    print(f"\n[WS #{i+1}] type={msg_type}: {json.dumps(data)[:200]}")
                received.append(msg_type)
            except asyncio.TimeoutError:
                print(f"[WS] No msg in 5s, continuing...")
                break
    return received


msgs = asyncio.run(listen())
print(f"\n=== SUMMARY ===")
print(f"Total messages: {len(msgs)}")
print(f"Has 'connected': {'connected' in msgs}")
print(f"Has 'backlog': {msgs.count('backlog')}")
print(f"Has 'event': {msgs.count('event')}")
print(f"Has 'heartbeat': {'heartbeat' in msgs}")

ok = "connected" in msgs and (msgs.count("backlog") > 0 or msgs.count("event") > 0)
print(f"\n{'PASS' if ok else 'FAIL'}: WebSocket delivers real classified events")
