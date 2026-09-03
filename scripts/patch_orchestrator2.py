"""Robust patch: replace classification tree using line-based replacement."""
import re

PATH = r"V:\SIH26162\packages\agents\src\orchestrator.py"

with open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

# Find start and end of the decision tree
start_marker = "    # " + chr(0x2500) + "* Classification Decision Tree " + chr(0x2500)
end_marker = "    state.is_critical = is_critical"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker, start_idx)
if start_idx < 0 or end_idx < 0:
    print("ERROR: Could not find markers")
    print("Start marker found at:", start_idx)
    print("End marker found at:", end_idx)
    raise SystemExit(1)

end_idx = end_idx + len(end_marker)

NEW_TREE = '''    # ── Classification Decision Tree ────────────────────────────────
    spatial_facility = state.spatial.facility_id is not None
    nearest_km = state.spatial.nearest_facility_km if state.spatial.nearest_facility_km is not None else 999.0
    land_cover = state.spatial.land_cover_class

    # Industrial fires are confirmed only when facility is within 5km
    is_near_facility = spatial_facility and nearest_km <= 5.0

    # PRIORITY 1: Near an industrial facility -> classify by CDE severity
    if is_near_facility:
        if cde_output.severity == "CRITICAL":
            classification: ThermalClass = "INDUSTRIAL_FIRE_EMERGENCY"
            severity: AlertSeverity = "CRITICAL"
            is_critical = True
        elif cde_output.severity == "WARNING":
            classification = "DEFERRED_FOR_ANALYST"
            severity = "WARNING"
            is_critical = False
        elif cde_output.severity == "WATCH":
            classification = "DEFERRED_FOR_ANALYST"
            severity = "WATCH"
            is_critical = False
        else:  # NORMAL
            classification = "PERSISTENT_INDUSTRIAL_FLARE"
            severity = "INFO"
            is_critical = False

    # PRIORITY 2: No facility -> classify by land cover
    elif land_cover == 40:
        classification = "AGRICULTURAL_BURNING"
        severity = "INFO"
        is_critical = False
    elif land_cover == 10:
        classification = "WILDFIRE"
        severity = "WARNING"
        is_critical = False
    elif land_cover in (20, 30, 60):
        # Shrubland/grassland/bare -> likely agricultural or controlled burn
        classification = "AGRICULTURAL_BURNING"
        severity = "INFO"
        is_critical = False
    else:
        classification = "UNKNOWN"
        severity = "INFO"
        is_critical = False

    # ── Apply to state ───────────────────────────────────────────────
    state.final_classification = classification
    state.final_confidence = fused_score
    state.cde_score = cde_output.score
    state.cde_severity = cde_output.severity
    state.alert_severity = severity
    state.is_critical = is_critical'''

new_content = content[:start_idx] + NEW_TREE + content[end_idx:]

with open(PATH, "w", encoding="utf-8") as f:
    f.write(new_content)

print(f"Replaced chars {start_idx}..{end_idx} ({end_idx-start_idx} chars) with {len(NEW_TREE)} chars")
