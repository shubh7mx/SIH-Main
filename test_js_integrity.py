import urllib.request
import re

r = urllib.request.urlopen("http://127.0.0.1:8000/", timeout=5)
html = r.read().decode()
scripts = re.findall(r"<script[^>]*>(.*?)</script>", html, re.DOTALL)
for i, s in enumerate(scripts):
    open_braces = s.count("{")
    close_braces = s.count("}")
    print(f"Script {i}: {len(s)} bytes, braces {open_braces}={close_braces} ({'BALANCED' if open_braces == close_braces else 'MISMATCHED'})")
    print(f"  starts: {s[:80].strip()}")
    print(f"  ends:   {s[-80:].strip()}")
    # Check for key functions
    for fn in ["initMap", "render", "fetchEvents", "connectWS", "toCanvas"]:
        present = fn in s
        print(f"    {fn}: {'OK' if present else 'MISSING'}")
