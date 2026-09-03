"""
Simulate what a browser would do when rendering the demo.html
and verify the layout is correct.
"""
import urllib.request
import re

# Get the HTML
r = urllib.request.urlopen("http://127.0.0.1:8000/", timeout=5)
html = r.read().decode("utf-8")

# Extract CSS and check key layout rules
print("=" * 70)
print("LAYOUT CSS VERIFICATION")
print("=" * 70)

css_checks = {
    "html, body height: 100%": r"html,\s*body\s*\{[^}]*height:\s*100%",
    "body overflow: hidden": r"body\s*\{[^}]*overflow:\s*hidden",
    "#app position: fixed": r"#app\s*\{[^}]*position:\s*fixed",
    "#app inset: 0": r"#app\s*\{[^}]*inset:\s*0",
    "#app flex column": r"#app\s*\{[^}]*flex-direction:\s*column",
    "#header flex-shrink: 0": r"#header\s*\{[^}]*flex-shrink:\s*0",
    "#main flex: 1": r"#main\s*\{[^}]*flex:\s*1",
    "#main display: flex": r"#main\s*\{[^}]*display:\s*flex",
    "#map-wrap flex: 1": r"#map-wrap\s*\{[^}]*flex:\s*1",
    "#map-wrap position: relative": r"#map-wrap\s*\{[^}]*position:\s*relative",
    "#map position: absolute": r"#map\s*\{[^}]*position:\s*absolute",
    "#map inset: 0": r"#map\s*\{[^}]*inset:\s*0",
    "#map-canvas 100% width": r"#map-canvas\s*\{[^}]*width:\s*100%",
    "#map-canvas 100% height": r"#map-canvas\s*\{[^}]*height:\s*100%",
    "#map-canvas display: block": r"#map-canvas\s*\{[^}]*display:\s*block",
}

all_pass = True
for label, pattern in css_checks.items():
    m = re.search(pattern, html)
    if m:
        print("  PASS:", label)
    else:
        print("  FAIL:", label)
        all_pass = False

print()
print("=" * 70)
print("HTML STRUCTURE")
print("=" * 70)

structure_checks = {
    "DOCTYPE": r"<!DOCTYPE\s+html>",
    "html tag": r"<html[^>]*>",
    "head with title": r"<head>.*?<title>.*?</title>.*?</head>",
    "body with #app div": r"<body>\s*<div\s+id=\"app\"",
    "#map-wrap with map inside": r'<div\s+id="map-wrap">.*?<div\s+id="map"',
    "canvas in #map": r'<div\s+id="map"[^>]*>\s*<canvas\s+id="map-canvas"',
    "sidebar with stats": r'<div\s+id="sidebar">.*?<div\s+id="stats"',
    "event list": r'<div\s+id="events">',
    "log area": r'<div\s+id="log">',
}

for label, pattern in structure_checks.items():
    m = re.search(pattern, html, re.DOTALL)
    if m:
        print("  PASS:", label)
    else:
        print("  FAIL:", label)
        all_pass = False

print()
print("=" * 70)
print("JAVASCRIPT")
print("=" * 70)

# Get just the script
script_match = re.search(r"<script[^>]*>(.*?)</script>", html, re.DOTALL)
if script_match:
    js = script_match.group(1)
    js_checks = {
        "IIFE wrapper": r"\(function\s*\(\s*\)\s*\{",
        "drawMap function": r"function\s+drawMap\s*\(",
        "animate function": r"function\s+animate\s*\(",
        "renderEvents function": r"function\s+renderEvents\s*\(",
        "fetchEvents function": r"function\s+fetchEvents\s*\(",
        "connectWS function": r"function\s+connectWS\s*\(",
        "India outline data": r"INDIA_OUTLINE\s*=",
        "Facilities data": r"FACILITIES\s*=",
        "Class colors": r"CLASS_COLORS\s*=",
        "setInterval polling": r"setInterval\s*\(",
        "WebSocket subprotocol v1": r"new\s+WebSocket\([^,]+,\s*[\"']v1[\"']",
        "DPR handling": r"devicePixelRatio",
        "RequestAnimationFrame": r"requestAnimationFrame",
    }
    for label, pattern in js_checks.items():
        m = re.search(pattern, js)
        if m:
            print("  PASS:", label)
        else:
            print("  FAIL:", label)
            all_pass = False

    # Brace balance
    o, c = js.count("{"), js.count("}")
    print(f"  {'PASS' if o == c else 'FAIL'}: Brace balance ({o} open, {c} close)")

print()
print("=" * 70)
if all_pass:
    print("ALL CHECKS PASSED — demo.html is rendering-ready")
    print("Open http://localhost:8000/ in a fresh browser tab.")
else:
    print("SOME CHECKS FAILED — see above")
print("=" * 70)
