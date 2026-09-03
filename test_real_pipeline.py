"""Verify the full real-time pipeline is working: real NASA data → 6-agent swarm → WebSocket."""
import asyncio
import json
import urllib.request


def show_events():
    """Show all events in the store with full classification detail."""
    r = urllib.request.urlopen("http://127.0.0.1:8000/api/v1/events?limit=10", timeout=5)
    evs = json.loads(r.read())
    print(f"\n=== STORED EVENTS ({len(evs)}) ===")
    for e in evs:
        cls = e.get("classification", "?")
        fac = e.get("facility_name", "Unknown")
        conf = e.get("confidence_score", 0)
        frp = e.get("frp_megawatts", 0)
        bt = e.get("brightness_temp_kelvin", 0)
        crit = e.get("is_critical_alert", False)
        cde = e.get("cde_anomaly_score", 0)
        sev = e.get("alert_severity", "?")
        src = e.get("satellite_source", "?")
        lat = e.get("latitude", 0)
        lon = e.get("longitude", 0)
        acq = e.get("acq_datetime", "?")
        print(f"  {src:18s} | {cls:30s} | {sev:8s} | {fac:35s} | FRP={frp:6.1f} MW | BT={bt:5.0f}K | CDE={cde:.2f} | conf={conf:.2f} | crit={crit}")
        print(f"  {'':18s}   lat={lat:.4f}, lon={lon:.4f} | acq={acq[:19]}")


def show_analytics():
    r = urllib.request.urlopen("http://127.0.0.1:8000/api/v1/analytics/summary", timeout=5)
    d = json.loads(r.read())
    print(f"\n=== ANALYTICS ===")
    print(f"  Total events processed: {d.get('total_events_processed')}")
    print(f"  Critical alerts:        {d.get('critical_alerts_count')}")
    print(f"  Class breakdown:        {d.get('class_breakdown')}")
    print(f"  Mean latency:           {d.get('mean_latency_seconds')}s")


def show_health():
    r = urllib.request.urlopen("http://127.0.0.1:8000/api/v1/health", timeout=5)
    d = json.loads(r.read())
    print(f"\n=== HEALTH ===")
    print(f"  Status:  {d.get('status')}")
    print(f"  Events:  {d['components']['event_store']['events_stored']}")
    print(f"  Worker:  polls={d['components']['firms_worker']['polls_completed']}, healthy={d['components']['firms_worker']['healthy']}")
    print(f"  Redis:   {d['components']['redis']}")
    print(f"  NASA:    {d['components'].get('nasa_firms', 'unknown')}")


show_health()
show_analytics()
show_events()
