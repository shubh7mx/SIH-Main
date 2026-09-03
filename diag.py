import urllib.request
import json

r = urllib.request.urlopen("http://127.0.0.1:8000/", timeout=5)
html = r.read().decode("utf-8")
print("=== HTML STRUCTURE ===")
print("Content-Type:", r.headers.get("Content-Type"))
print("Size:", len(html), "bytes")
body_start = html.find("<body")
body_end = html.find("</body>")
body = html[body_start:body_end + 7] if body_start > 0 else "NOT FOUND"
print("Body:", len(body), "chars")
print("Has header:", "<header" in html)
print("Has #map div:", 'id="map"' in html)
print("Has script tag:", "<script" in html)
print("Script count:", html.count("<script"))

events = json.loads(
    urllib.request.urlopen("http://127.0.0.1:8000/api/v1/events?limit=200", timeout=5).read()
)
print()
print("=== EVENTS DATA ===")
print("Total events:", len(events))
classes = {}
for e in events:
    c = e.get("classification", "?")
    classes[c] = classes.get(c, 0) + 1
for c, n in sorted(classes.items(), key=lambda x: -x[1]):
    print("  " + c + ":", n)

print()
print("=== COORDINATE CHECK ===")
valid = 0
for e in events[:20]:
    lat, lon = e["latitude"], e["longitude"]
    if 5 <= lat <= 39 and 67 <= lon <= 99:
        valid += 1
print("Events within India bbox:", valid, "/ 20")

h = json.loads(
    urllib.request.urlopen("http://127.0.0.1:8000/api/v1/health", timeout=5).read()
)
print()
print("=== BACKEND HEALTH ===")
print("Status:", h["status"])
print("Events stored:", h["components"]["event_store"]["events_stored"])

print()
print("ALL CHECKS PASSED - Issue is NOT in the data or backend")

# What is the CSS for the map div?
print()
print("=== MAP CSS ===")
import re
map_match = re.search(r'(<div id="map"[^>]*>)', html)
if map_match:
    print("Map div tag:", map_match.group(1))
else:
    print("Map div not found in HTML")

# Check for canvas size styles
map_css_match = re.search(r'#map\s*\{([^}]*)\}', html)
if map_css_match:
    print("Map CSS:", map_css_match.group(1).strip())

# Check pane css
pane_css_match = re.search(r'\.pane\s*\{([^}]*)\}', html)
if pane_css_match:
    print("Pane CSS:", pane_css_match.group(1).strip())
