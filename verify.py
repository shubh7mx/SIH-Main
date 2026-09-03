import urllib.request
import re

r = urllib.request.urlopen("http://127.0.0.1:8000/", timeout=5)
html = r.read().decode("utf-8")
print("Size:", len(html), "bytes")
print("Has #map-canvas:", 'id="map-canvas"' in html)
print("Has drawMap:", "function drawMap" in html)
print("Has #app container:", 'id="app"' in html)
print("Has fixed layout:", "position: fixed" in html)
print("Has fetchEvents:", "function fetchEvents" in html)
print("Has connectWS:", "function connectWS" in html)

scripts = re.findall(r"<script[^>]*>(.*?)</script>", html, re.DOTALL)
for i, s in enumerate(scripts):
    o, c = s.count("{"), s.count("}")
    status = "OK" if o == c else "MISMATCH"
    print(f"Script {i}: {len(s)} bytes, braces {o}={c} ({status})")
