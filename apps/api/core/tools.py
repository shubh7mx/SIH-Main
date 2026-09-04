# -*- coding: utf-8 -*-
"""Tool calling architecture for SIH26162 Copilot Intelligence Engine."""
import json
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger("sih26162.intelligence.tools")

COPILOT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "rank_cities_by_thermal",
            "description": "Aggregates and ranks Indian cities or districts by total thermal anomaly count, cumulative FRP (MW), and peak intensity.",
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "description": "Number of top cities to return (default 10)"},
                    "sort_by": {"type": "string", "enum": ["total_frp", "event_count", "max_frp"], "description": "Metric to rank by"}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_facility_status",
            "description": "Retrieves real-time telemetry, 30-day baseline, and CDE deviation for a specific named industrial facility (e.g. Jamnagar, Paradip, Haldia, Mundra, Hazira, Jamshedpur).",
            "parameters": {
                "type": "object",
                "properties": {
                    "facility_name": {"type": "string", "description": "Name or keyword of the facility"}
                },
                "required": ["facility_name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_state_thermal_summary",
            "description": "Gets state-level thermal statistics, active hotspot count, agricultural vs industrial breakdown, and risk assessment for a specific Indian state (e.g. Punjab, Gujarat, Odisha, Maharashtra, Haryana).",
            "parameters": {
                "type": "object",
                "properties": {
                    "state_name": {"type": "string", "description": "Name of the Indian state"}
                },
                "required": ["state_name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_critical_emergencies",
            "description": "Lists all currently active Level-1 critical industrial fire emergencies (>3.0σ CDE deviation or emergency classification).",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "query_active_hotspots",
            "description": "Queries filtered active thermal detections by classification (e.g. AGRICULTURAL_BURNING, PERSISTENT_INDUSTRIAL_FLARE, WILDFIRE) or minimum FRP.",
            "parameters": {
                "type": "object",
                "properties": {
                    "classification": {"type": "string", "description": "Classification filter"},
                    "min_frp": {"type": "number", "description": "Minimum FRP in MW"},
                    "limit": {"type": "integer", "description": "Max events to return"}
                },
                "required": []
            }
        }
    }
]


def execute_copilot_tool(
    name: str, args: Dict[str, Any], events: List[Dict[str, Any]], analytics: Dict[str, Any]
) -> Dict[str, Any]:
    """Executes a Copilot tool function against the live event store and analytics."""
    if name == "rank_cities_by_thermal":
        limit = args.get("limit", 10)
        sort_by = args.get("sort_by", "total_frp")
        
        city_data: Dict[str, Dict[str, Any]] = {}
        for e in events:
            fac = e.get("facility_name") or ""
            lat = float(e.get("latitude") or 0)
            lon = float(e.get("longitude") or 0)
            frp = float(e.get("frp_megawatts") or 0)
            bt = float(e.get("brightness_temp_kelvin") or 0)
            cls = e.get("classification") or "UNKNOWN"
            
            # City extraction
            city = "Other"
            state = "India"
            fn_low = fac.lower()
            if "jamnagar" in fn_low: city, state = "Jamnagar", "Gujarat"
            elif "mundra" in fn_low: city, state = "Mundra (Kutch)", "Gujarat"
            elif "haldia" in fn_low: city, state = "Haldia", "West Bengal"
            elif "paradip" in fn_low: city, state = "Paradip", "Odisha"
            elif "jamshedpur" in fn_low: city, state = "Jamshedpur", "Jharkhand"
            elif "hazira" in fn_low or "surat" in fn_low: city, state = "Surat", "Gujarat"
            elif "panipat" in fn_low: city, state = "Panipat", "Haryana"
            elif "vizag" in fn_low or "visakhapatnam" in fn_low: city, state = "Visakhapatnam", "Andhra Pradesh"
            elif "mumbai" in fn_low: city, state = "Mumbai", "Maharashtra"
            elif "ludhiana" in fn_low: city, state = "Ludhiana", "Punjab"
            elif "bathinda" in fn_low: city, state = "Bathinda", "Punjab"
            elif "angul" in fn_low: city, state = "Angul", "Odisha"
            elif 29.5 <= lat <= 32.5: city, state = "Ludhiana / Patiala Corridor", "Punjab"
            elif 20.1 <= lat <= 24.7: city, state = "Ahmedabad / Vadodara Belt", "Gujarat"
            elif 17.8 <= lat <= 22.6: city, state = "Cuttack / Bhubaneswar Corridor", "Odisha"
            else: city, state = "Regional Sector", "Mainland Grid"

            key = f"{city}, {state}"
            if key not in city_data:
                city_data[key] = {
                    "city": city,
                    "state": state,
                    "hotspot_count": 0,
                    "total_frp_mw": 0.0,
                    "max_frp_mw": 0.0,
                    "max_brightness_k": 0.0,
                    "primary_classes": set(),
                    "has_critical": False,
                }
            
            c = city_data[key]
            c["hotspot_count"] += 1
            c["total_frp_mw"] += frp
            c["max_frp_mw"] = max(c["max_frp_mw"], frp)
            c["max_brightness_k"] = max(c["max_brightness_k"], bt)
            c["primary_classes"].add(cls)
            if e.get("is_critical_alert"):
                c["has_critical"] = True

        ranked = list(city_data.values())
        if sort_by == "event_count":
            ranked.sort(key=lambda x: x["hotspot_count"], reverse=True)
        elif sort_by == "max_frp":
            ranked.sort(key=lambda x: x["max_frp_mw"], reverse=True)
        else:
            ranked.sort(key=lambda x: x["total_frp_mw"], reverse=True)

        for r in ranked:
            r["primary_classes"] = list(r["primary_classes"])
            r["total_frp_mw"] = round(r["total_frp_mw"], 1)
            r["max_frp_mw"] = round(r["max_frp_mw"], 1)
            r["max_brightness_k"] = round(r["max_brightness_k"], 1)

        return {"top_cities": ranked[:limit], "total_regions_evaluated": len(ranked)}

    elif name == "get_facility_status":
        fn_req = args.get("facility_name", "").lower()
        matched = [e for e in events if fn_req in (e.get("facility_name") or "").lower()]
        if not matched:
            return {"found": False, "message": f"No active detections recorded for facility matching '{fn_req}'"}
        
        f = matched[0]
        return {
            "found": True,
            "facility_name": f.get("facility_name"),
            "facility_type": f.get("facility_type"),
            "classification": f.get("classification"),
            "frp_mw": float(f.get("frp_megawatts") or 0),
            "brightness_temp_k": float(f.get("brightness_temp_kelvin") or 0),
            "cde_deviation_sigma": float(f.get("cde_anomaly_score") or 0),
            "is_critical_alert": bool(f.get("is_critical_alert")),
            "coordinates": [float(f.get("latitude") or 0), float(f.get("longitude") or 0)],
            "satellite": f.get("satellite_source", "VIIRS"),
            "status_interpretation": "CRITICAL EMERGENCY" if f.get("is_critical_alert") else "NOMINAL ROUTINE FLARING"
        }

    elif name == "get_critical_emergencies":
        crits = [
            {
                "id": e.get("id"),
                "facility_name": e.get("facility_name"),
                "frp_mw": float(e.get("frp_megawatts") or 0),
                "brightness_k": float(e.get("brightness_temp_kelvin") or 0),
                "cde_sigma": float(e.get("cde_anomaly_score") or 0),
                "coords": [float(e.get("latitude") or 0), float(e.get("longitude") or 0)],
            }
            for e in events if e.get("is_critical_alert") or e.get("classification") == "INDUSTRIAL_FIRE_EMERGENCY"
        ]
        return {"critical_count": len(crits), "emergencies": crits}

    elif name == "get_state_thermal_summary":
        s_req = args.get("state_name", "").lower()
        st_events = [e for e in events if s_req in (e.get("facility_name") or "").lower() or (s_req == "punjab" and 29.5 <= float(e.get("latitude") or 0) <= 32.5)]
        return {
            "state": args.get("state_name"),
            "active_hotspots": len(st_events),
            "total_frp_mw": round(sum(float(e.get("frp_megawatts") or 0) for e in st_events), 1),
            "critical_count": sum(1 for e in st_events if e.get("is_critical_alert")),
            "events_sample": [
                {
                    "facility": e.get("facility_name"),
                    "class": e.get("classification"),
                    "frp_mw": float(e.get("frp_megawatts") or 0),
                    "cde_sigma": float(e.get("cde_anomaly_score") or 0),
                }
                for e in st_events[:5]
            ]
        }

    return {"error": f"Unknown tool: {name}"}
