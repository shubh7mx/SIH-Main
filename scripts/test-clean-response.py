import re

def clean_response(text: str) -> str:
    if not text:
        return ""

    cleaned = text

    # 1. Strip explicit thinking tags (closed or unclosed)
    cleaned = re.sub(r"(?i)\x3cthink\x3e[\s\S]*?(?:\x3c/think\x3e|$)", "", cleaned)
    cleaned = re.sub(r"(?i)\x3cthought\x3e[\s\S]*?(?:\x3c/thought\x3e|$)", "", cleaned)
    cleaned = re.sub(r"(?i)\x3creasoning\x3e[\s\S]*?(?:\x3c/reasoning\x3e|$)", "", cleaned)
    cleaned = re.sub(r"(?i)\x3c!--[\s\S]*?(?:--\x3e|$)", "", cleaned)

    # 2. Check for transition markers where the model finishes thinking and starts its response
    # E.g. "Let's craft:", "Let's write the response:", "Final Response:", "Final Answer:", "Here is the response:"
    pivot_patterns = [
        r"(?i)(?:^|\n)(?:let's (?:craft|draft|write|produce|format|summarize|output)(?:[:\s\S]*?:|\.{1,3}|\n))\s*",
        r"(?i)(?:^|\n)(?:final (?:response|answer|brief|summary|assessment)[:\s]*\n*)\s*",
        r"(?i)(?:^|\n)(?:here (?:is|are) the (?:tactical brief|brief|response|assessment|summary)[:\s]*\n*)\s*",
    ]
    for pat in pivot_patterns:
        matches = list(re.finditer(pat, cleaned))
        if matches:
            last_match = matches[-1]
            candidate = cleaned[last_match.end():].strip()
            if len(candidate) > 30:
                cleaned = candidate

    # 3. If there are still preamble lines starting with "We need to...", "We must...", "We have...", "Let's...", "I need to..."
    # before the first heading/bullet point, strip them:
    # Look for the start of the real structured answer
    lines = cleaned.split("\n")
    start_idx = 0
    in_preamble = True
    for i, line in enumerate(lines):
        trimmed = line.strip()
        if not trimmed:
            continue
        # Check if line looks like scratchpad chatter
        is_scratchpad = bool(re.match(
            r"(?i)^(?:we need to|we have|we must|we should|i need to|i will|let's|note that|we'll parse|list entries|each heading|we cannot)\b",
            trimmed
        ))
        # Check if line looks like an empty heading outline (e.g. just "[TAXONOMY & THREAT SEVERITY]" followed immediately by another header)
        is_header = trimmed.startswith("[") and trimmed.endswith("]")
        if is_header and i + 1 < len(lines) and lines[i + 1].strip().startswith("["):
            # Empty header outline in thinking!
            is_scratchpad = True

        if not is_scratchpad:
            start_idx = i
            in_preamble = False
            break

    if not in_preamble:
        cleaned = "\n".join(lines[start_idx:]).strip()

    # 4. If the text has double headers, e.g. [TAXONOMY & THREAT SEVERITY] appeared earlier with no bullets
    # and then appeared later with bullets, extract from the actual populated section
    tax_matches = list(re.finditer(r"\[TAXONOMY & THREAT SEVERITY\]", cleaned))
    if len(tax_matches) > 1:
        # Take the last one
        cleaned = cleaned[tax_matches[-1].start():].strip()

    return cleaned.strip()

# Test sample from user:
sample = """Summarize current thermal anomalies across India
[TAXONOMY & THREAT SEVERITY]
[RADIOMETRIC & THERMAL TELEMETRY]
[SPATIAL & FACILITY CONTEXT]
[BASELINE & TEMPORAL VARIANCE]
[ATMOSPHERIC & PLUME DISPERSAL]
[TACTICAL RECOMMENDATIONS & SOP]

We need to reference concrete numbers: FRP MW, brightness temperature K, CDE sigma, coordinates. However we have no CDE sigma given; maybe we can note not available. But we must reference concrete numbers where possible.

We need to summarize current thermal anomalies across India based on the 40 samples. Provide counts, classifications, ranges, maybe highest FRP, highest BT, etc.

We have system KPIs: total stored 500, critical alerts 0, oldest event at 2026-09-02T07:31:00+00:00, newest event at 2026-09-04T11:42:00+00:00.

We need to be direct, factual, calm, no speculation.

We need to output exactly categories with headings and content under each.

Each heading on its own line, then bullet points or sentences.

We must not output internal reasoning.

Let's craft:

[TAXONOMY & THREAT SEVERITY]
- 40 active thermal anomalies detected.
- Classification breakdown: Agricultural Burning: 35 samples, Wildfire: 5 samples.
- No events flagged as critical (critical: False for all).
- Threat severity: Low to moderate; all non-critical.

[RADIOMETRIC & THERMAL TELEMETRY]
- Peak FRP: 78 MW.
- Peak BT: 365 K.

[TACTICAL RECOMMENDATIONS & SOP]
- Continue standard monitoring.
"""

cleaned = clean_response(sample)
print("--- CLEANED RESULT ---")
print(cleaned)
print("----------------------")
assert not "Let's craft" in cleaned
assert not "We need to" in cleaned
assert cleaned.startswith("[TAXONOMY & THREAT SEVERITY]")
print("TEST PASSED!")
