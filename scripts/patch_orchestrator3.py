"""Find exact markers and replace."""
import re

PATH = r"V:\SIH26162\packages\agents\src\orchestrator.py"

with open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

# Use regex to find the comment block before the decision tree
# Look for "Classification Decision Tree"
m = re.search(r'    # [─=*\-]+ Classification Decision Tree', content)
print(f"Decision tree marker at: {m.start() if m else 'NOT FOUND'}")

# Look for end marker
m_end = re.search(r'    state\.is_critical = is_critical', content)
print(f"End marker at: {m_end.start() if m_end else 'NOT FOUND'}")

# Find from decision tree to is_critical = is_critical
if m and m_end:
    start = m.start()
    end = m_end.end()
    print(f"Replacing {end-start} chars")

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

    new_content = content[:start] + NEW_TREE + content[end:]
    with open(PATH, "w", encoding="utf-8") as f:
        f.write(new_content)
    print(f"SUCCESS! File now {len(new_content)} chars")
else:
    print("Failed to find markers")
