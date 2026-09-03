"""Debug Uttarakhand classification"""
import sys
sys.path.insert(0, "V:/SIH26162")
from packages.agents.src.state import SwarmState
from packages.agents.src.spatial_agent import spatial_pipeline
from packages.agents.src.temporal_agent import temporal_pipeline
from packages.agents.src.vision_agent import vision_pipeline
from packages.agents.src.orchestrator import orchestrator_node

state = SwarmState(
    hotspot_id="test", latitude=30.082, longitude=79.241,
    frp_mw=68.5, brightness_temp_k=412.0, day_night="D",
)
state = spatial_pipeline(state)
print(f"facility_id: {state.spatial.facility_id}")
print(f"nearest_km: {state.spatial.nearest_facility_km}")
print(f"land_cover_class: {state.spatial.land_cover_class}")
print(f"land_cover_name: {state.spatial.land_cover_name}")
state = temporal_pipeline(state)
state = vision_pipeline(state)
state = orchestrator_node(state)
print(f"final_class: {state.final_classification}")
