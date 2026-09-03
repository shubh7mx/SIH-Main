# Why the Map Is Not Showing — Root Cause Diagnosis

## The Problem

The browser is serving **stale cached HTML** from a previous Next.js build. The cached
page was generated before the India map component existed. The map IS in the source
code but the browser hasn't downloaded the new JS bundle yet.

**Evidence:**
- `http://localhost:3000` returns HTML with `Backend unreachable — displaying demo data`
- The HTML has the OLD React component tree (no `IndiaCanvas` in the DOM)
- The API works: `curl http://localhost:8000/api/v1/health` returns `OPERATIONAL`
- CORS is configured correctly on the backend

## The Fix — Two Options

### Option A: One-Click Starter (Recommended)
```powershell
cd V:\SIH26162
.\start_demo.cmd
```
Then hard-refresh your browser: **Ctrl+Shift+R** on `http://localhost:3000`.

### Option B: Manual Restart
```powershell
# 1. Stop existing frontend
taskkill /F /IM node.exe 2>$null

# 2. Clear cache
cd V:\SIH26162\apps\web
Remove-Item -Recurse -Force .next

# 3. Restart frontend
npm run dev
```

Then hard-refresh: **Ctrl+Shift+R**

---

## What Gets Fixed When You Do This

### Landing Page Map
- `IndiaCanvas` uses `ResizeObserver` + `requestAnimationFrame` for responsive sizing
- Map container has explicit `minHeight: 420px` and `aspectRatio: 6/5`
- India outline polygon drawn with atmospheric glow
- Facility dots for 7 known refineries
- Live hotspot markers from real NASA FIRMS data
- Animated scan line sweeping across the map
- Lat/lon labels (38°N, 6°N, 68°E, 98°E)

### Console View Map (`Open Intelligence Console` button)
- `LiveMap.tsx` rewritten with layout-aware canvas rendering
- ResizeObserver for live resize handling
- India polygon with fill
- 18 facility dots
- Real-time hotspot markers

### WebSocket Stream
- `useAlertStream` now listens for `event` and `backlog` message types
  (matches what the backend sends, instead of legacy `new_event`/`simulated_event`)

### Real Data Flow
- REST polling: `useEvents` polls every 30s from `http://localhost:8000/api/v1/events`
- WebSocket: streams live events as they are classified
- 200 real NASA FIRMS events currently in the backend

---

## After Restart — What You'll See

1. **Landing page** — India canvas map with 200 real classified events
   - Agricultural burning (yellow) — most events
   - Industrial fires near refineries (orange/red)
   - Facility dots in cyan
   - Scan line animation

2. **Intelligence Console** — full tactical view
   - Real-time map with satellite tiles (if MapLibre loads)
   - Event list panel on the right
   - WebSocket status indicator: "STREAM: LIVE"
   - Click any event for details

3. **Backend is running** and classifying events every 10 minutes
