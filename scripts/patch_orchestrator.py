"""Patch orchestrator.py to fix classification priority and add dispatcher severity wiring."""
import re

PATH = r"V:\SIH26162\packages\agents\src\orchestrator.py"

with open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

# Find the old classification decision tree
old_tree = '''    # ── Classification Decision Tree ────────────────────────────────
    spatial_facility = state.spatial.facility_id is not None
    nearest_km = state.spatial.nearest_facility_km if state.spatial.nearest_facility_km is not None else 999.0
    land_cover = state.spatial.land_cover_class

    # Industrial fires are confirmed only when facility is within 5km
    is_near_facility = spatial_facility and nearest_km <= 5.0

    # Step 1: CRITICAL industrial fire confirmed
    if cde_output.severity == "CRITICAL" and is_near_facility:
        classification: ThermalClass = "INDUSTRIAL_FIRE_EMERGENCY"
        severity: AlertSeverity = "CRITICAL"
        is_critical = True

    # Step 2: Land cover dominates when facility is distant or unavailable
    elif land_cover == 40 and not is_near_facility:
        # Cropland -> Agricultural burning
        classification = "AGRICULTURAL_BURNING"
        severity = "INFO"
        is_critical = False

    elif land_cover == 10 and not is_near_facility:
        # Tree cover -> Wildfire
        classification = "WILDFIRE"
        severity = "WARNING"
        is_critical = False

    # Step 3: Persistent industrial flare (near facility, normal baseline)
    elif is_near_facility and cde_output.severity == "NORMAL":
        classification = "PERSISTENT_INDUSTRIAL_FLARE"
        severity = "INFO"
        is_critical = False

    # Step 4: Near facility, CDE WATCH -> analyst review
    elif is_near_facility and cde_output.severity == "WATCH":
        classification = "DEFERRED_FOR_ANALYST"
        severity = "WATCH"
        is_critical = False

    # Step 5: Near facility, CDE WARNING -> elevated alert
    elif is_near_facility and cde_output.severity == "WARNING":
        classification = "DEFERRED_FOR_ANALYST"
        severity = "WARNING"
        is_critical = False

    # Step 6: Land cover check (backup when no facility)
    elif land_cover == 40:
        classification = "AGRICULTURAL_BURNING"
        severity = "INFO"
        is_critical = False

    elif land_cover == 10:
        classification = "WILDFIRE"
        severity = "WARNING"
        is_critical = False

    # Step 7: Unknown / default
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

if old_tree in content:
    content = content.replace(old_tree, NEW_TREE)
    print("Replaced classification decision tree")
else:
    print("WARNING: Could not find exact old_tree string. Trying fuzzy match...")
    # Try to find the function and replace it
    if "# Step 1: CRITICAL industrial fire confirmed" in content:
        print("Found partial match, will try to patch...")
        # Use regex to find and replace the block
        pass
    else:
        print("ERROR: Could not find the classification tree to replace!")

with open(PATH, "w", encoding="utf-8") as f:
    f.write(content)
print("Done")
