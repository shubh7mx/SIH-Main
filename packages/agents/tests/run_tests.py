"""Phase 2 Test Runner — writes results to file"""
import sys, os
# Add project root to path
sys.path.insert(0, "V:/SIH26162")
from packages.agents.src.graph import run_swarm

results = []

def run_test(name, hotspot, expected_class, expected_critical):
    try:
        r = run_swarm(hotspot)
        passed = (r["classification"] == expected_class and r["is_critical_alert"] == expected_critical)
        status = "PASS" if passed else "FAIL"
        results.append(f"[{status}] {name}: class={r['classification']}, cde={r['cde_anomaly_score']}, critical={r['is_critical_alert']}, conf={r['confidence_score']:.3f}")
        return passed
    except Exception as e:
        results.append(f"[ERROR] {name}: {e}")
        return False

run_test("Jamnagar Critical Fire",
    {"firms_id": "evt-001", "latitude": 22.368, "longitude": 69.832,
     "frp_megawatts": 842.0, "brightness_temp_kelvin": 942.5,
     "confidence_pct": 98, "satellite_source": "VIIRS_SNPP_NRT", "day_night": "N"},
    "INDUSTRIAL_FIRE_EMERGENCY", True)

run_test("Haldia Persistent Flare",
    {"firms_id": "evt-002", "latitude": 22.031, "longitude": 88.082,
     "frp_megawatts": 145.2, "brightness_temp_kelvin": 780.0,
     "confidence_pct": 92, "satellite_source": "VIIRS_NOAA20_NRT", "day_night": "N"},
    "PERSISTENT_INDUSTRIAL_FLARE", False)

run_test("Punjab Agricultural",
    {"firms_id": "evt-003", "latitude": 30.342, "longitude": 75.832,
     "frp_megawatts": 42.0, "brightness_temp_kelvin": 365.4,
     "confidence_pct": 88, "satellite_source": "VIIRS_SNPP_NRT", "day_night": "D"},
    "AGRICULTURAL_BURNING", False)

run_test("Uttarakhand Wildfire",
    {"firms_id": "evt-004", "latitude": 30.082, "longitude": 79.241,
     "frp_megawatts": 68.5, "brightness_temp_kelvin": 412.0,
     "confidence_pct": 85, "satellite_source": "VIIRS_SNPP_NRT", "day_night": "D"},
    "WILDFIRE", False)

run_test("CDE Boundary (4-sigma)",
    {"firms_id": "boundary-1", "latitude": 22.368, "longitude": 69.832,
     "frp_megawatts": 860.0, "brightness_temp_kelvin": 930.0,
     "confidence_pct": 98, "satellite_source": "VIIRS_SNPP_NRT", "day_night": "N"},
    "INDUSTRIAL_FIRE_EMERGENCY", True)

run_test("CDE Boundary (1-sigma normal)",
    {"firms_id": "boundary-2", "latitude": 22.368, "longitude": 69.832,
     "frp_megawatts": 155.0, "brightness_temp_kelvin": 820.0,
     "confidence_pct": 92, "satellite_source": "VIIRS_SNPP_NRT", "day_night": "N"},
    "PERSISTENT_INDUSTRIAL_FLARE", False)

output = "SIH26162 Phase 2 — Test Results\n" + "=" * 50 + "\n"
output += "\n".join(results) + "\n"
passed = sum(1 for r in results if "[PASS]" in r)
total = len(results)
output += f"\n{passed}/{total} tests passed.\n"
if passed == total:
    output += "\nAll Phase 2 swarm tests passed.\n"

with open("V:\\SIH26162\\packages\\agents\\tests\\results.txt", "w", encoding="utf-8") as f:
    f.write(output)
print(output)
