"""Debug nearest facility to Uttarakhand"""
import sys
sys.path.insert(0, "V:/SIH26162")
from packages.agents.src.spatial_agent import haversine_km, _FACILITY_REGISTRY

lat, lon = 30.082, 79.241
for f in _FACILITY_REGISTRY:
    d = haversine_km(lat, lon, f["lat"], f["lon"])
    if d < 100:
        print(f"{f['name']}: {d:.2f} km")
