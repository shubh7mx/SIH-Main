import re
from pathlib import Path

# Add multiple test cases
test_cases = [
    # Case 1: Standard copilot Q&A where model thinks before answering
    """Thinking: The user wants to know how many critical fires exist in the dataset.
I should check the critical count in the system KPIs. The count is 0.
Let's answer directly.

There are currently 0 active Critical Industrial Fire Emergencies across the monitored fleet. All 40 evaluated hotspots are classified as non-critical agricultural or wildfire anomalies.""",

    # Case 2: DeepSeek-R1 style <think> block
    """<think>
Evaluating anomalies in Gujarat...
Found 3 agricultural hotspots and 1 flare.
</think>
In Gujarat, 4 thermal anomalies are currently tracked: 3 agricultural burns and 1 persistent industrial flare at Jamnagar Refinery (142 MW). Threat level is nominal.""",

    # Case 3: Raw thought process with "Let's craft:"
    """We need to summarize the situation.
Let's outline the facts:
- Total: 500 events
- Critical: 0
Let's craft:
Current situational overview indicates 500 total registered thermal anomalies over the observation period with 0 active critical emergencies.""",
]

# Run clean_response on all cases
from importlib.machinery import SourceFileLoader
mod = SourceFileLoader("test_clean", "V:/SIH26162/scripts/test-clean-response.py").load_module()

for i, tc in enumerate(test_cases, 1):
    res = mod.clean_response(tc)
    print(f"=== Case {i} ===")
    print(res)
    print("---")
    assert not "think" in res.lower() or "thinking" in res.lower()
    assert not "Let's craft" in res
    assert not "We need to" in res
print("ALL CASES PASSED!")
