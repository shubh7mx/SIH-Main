"""Phase 3 End-to-End Smoke Test"""
import sys
import json
import time
sys.path.insert(0, "V:/SIH26162")

import urllib.request

BASE = "http://127.0.0.1:8765/api/v1"

def get(path):
    try:
        req = urllib.request.Request(BASE + path)
        with urllib.request.urlopen(req, timeout=5) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        return {"error": str(e)}

def post(path, body):
    try:
        data = json.dumps(body).encode("utf-8")
        req = urllib.request.Request(BASE + path, data=data,
            headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        return {"error": str(e)}

print("=" * 55)
print("SIH26162 Phase 3 — End-to-End Smoke Test")
print("=" * 55)

# Test 1: Root
print("\n[1] Root endpoint")
r = get("/")
print(f"    Status: {r.get('name', 'ERROR: ' + str(r))}")

# Test 2: Health
print("\n[2] Health check")
r = get("/health")
print(f"    Status: {r.get('status', '?')}")
print(f"    Event store: events_stored={r.get('components', {}).get('event_store', {}).get('events_stored', '?')}")
print(f"    Worker: running={r.get('components', {}).get('firms_worker', {}).get('healthy', '?')}")
print(f"    Redis: {r.get('components', {}).get('redis', '?')}")

# Test 3: Stats
print("\n[3] Stats endpoint")
r = get("/stats")
print(f"    Events stored: {r.get('events', {}).get('total_stored', 0)}")
print(f"    WS clients: {r.get('websocket', {}).get('total_clients', 0)}")
print(f"    Redis: {r.get('redis', '?')}")

# Test 4: Liveness
print("\n[4] Liveness probe")
r = get("/health/live")
print(f"    Status: {r.get('status', '?')}")

# Test 5: Readiness
print("\n[5] Readiness probe")
r = get("/health/ready")
print(f"    Status: {r.get('status', '?')}")

# Test 6: Publish a test event
print("\n[6] Event publish (trigger agent swarm)")
test_event = {
    "id": "smoke-test-001",
    "firms_id": "smoke-test-001",
    "latitude": 22.368,
    "longitude": 69.832,
    "frp_megawatts": 842.0,
    "brightness_temp_kelvin": 942.5,
    "confidence_pct": 98,
    "satellite_source": "VIIRS_SNPP_NRT",
    "day_night": "N",
    "acq_datetime": "2026-01-15T14:32:00Z",
}
r = post("/events/publish", test_event)
print(f"    Publish result: {r}")

# Wait for async processing
time.sleep(2)

# Test 7: Check event store
print("\n[7] Event store after processing")
r = get("/stats")
print(f"    Events stored: {r.get('events', {}).get('total_stored', 0)}")
by_class = r.get('events', {}).get('by_classification', {})
for cls, cnt in by_class.items():
    print(f"    - {cls}: {cnt}")

# Test 8: List events
print("\n[8] List events (GET /events)")
r = get("/events")
print(f"    Events returned: {len(r)}")
if r:
    e = r[0]
    print(f"    First event: {e.get('id', '?')} → {e.get('classification', '?')} (conf={e.get('confidence_score', 0):.3f})")

print("\n" + "=" * 55)
print("Phase 3 end-to-end smoke test: COMPLETE")
print("=" * 55)
