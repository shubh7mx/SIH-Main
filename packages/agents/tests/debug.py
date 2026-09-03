"""Debug CDE and orchestrator logic"""
import sys
sys.path.insert(0, "V:/SIH26162")
from packages.agents.src.spatial_agent import spatial_pipeline, haversine_km
from packages.agents.src.state import SwarmState
from packages.agents.src.cde import CoDisambiguationEngine, FacilityBaseline, CDEInput

# Direct test
state = SwarmState(
    hotspot_id="test",
    latitude=22.368, longitude=69.832,
    frp_mw=842.0, brightness_temp_k=942.5,
    day_night="N",
)
state = spatial_pipeline(state)
print(f"Facility: {state.spatial.facility_name}")
print(f"Type: {state.spatial.facility_type}")
print(f"Distance: {state.spatial.nearest_facility_km} km (type: {type(state.spatial.nearest_facility_km).__name__})")
print(f"LandCover: {state.spatial.land_cover_class} ({state.spatial.land_cover_name})")
print(f"Spatial score: {state.spatial.score}")

# Direct orchestrator test
from packages.agents.src.temporal_agent import temporal_pipeline
from packages.agents.src.vision_agent import vision_pipeline
from packages.agents.src.orchestrator import orchestrator_node
state = temporal_pipeline(state)
state = vision_pipeline(state)
state = orchestrator_node(state)
print(f"\nFinal class: {state.final_classification}")
print(f"CDE: {state.cde_score}, severity: {state.cde_severity}")
print(f"Critical: {state.is_critical}")

# CDE
baseline = FacilityBaseline("f", "Refinery", "refinery", 140.0, 18.0, 815.0, 9.0, 0, 0.95)
cde = CoDisambiguationEngine(baseline)
out = cde.evaluate(CDEInput(frp_mw=842.0, brightness_temp_k=942.5, day_night="N", hotspots_per_day=2))
print(f"\nCDE: z_frp={out.z_frp}, z_bt={out.z_bt}, diurnal={out.diurnal_anomaly}")
print(f"CDE score: {out.cde_score}, severity: {out.severity}")
