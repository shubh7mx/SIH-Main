from fastapi import APIRouter
from typing import List
from apps.api.models.schemas import FacilityItem

router = APIRouter(prefix="/facilities", tags=["Facilities"])

MOCK_FACILITIES: List[FacilityItem] = [
    FacilityItem(
        id="fac-001",
        osm_id="way/120938491",
        name="Reliance Jamnagar Petrochemical Complex",
        facility_type="refinery",
        operator="Reliance Industries Limited",
        state="Gujarat",
        district="Jamnagar",
        latitude=22.368,
        longitude=69.832,
        baseline_frp_mean=142.0,
        baseline_frp_std=14.5,
        active_hotspots_count=1
    ),
    FacilityItem(
        id="fac-002",
        osm_id="way/948271034",
        name="IOCL Haldia Refinery",
        facility_type="refinery",
        operator="Indian Oil Corporation Limited",
        state="West Bengal",
        district="Purba Medinipur",
        latitude=22.031,
        longitude=88.082,
        baseline_frp_mean=140.0,
        baseline_frp_std=12.0,
        active_hotspots_count=1
    ),
    FacilityItem(
        id="fac-003",
        osm_id="way/583920194",
        name="Tata Steel Jamshedpur Works",
        facility_type="metal_works",
        operator="Tata Steel Ltd",
        state="Jharkhand",
        district="East Singhbhum",
        latitude=22.804,
        longitude=86.202,
        baseline_frp_mean=195.0,
        baseline_frp_std=22.0,
        active_hotspots_count=0
    )
]

@router.get("", response_model=List[FacilityItem])
async def list_facilities():
    return MOCK_FACILITIES
