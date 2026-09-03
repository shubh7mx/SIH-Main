# 🎯 SIH26162 — Open the Live Demo

## ONE URL — Just Open This in Your Browser

```
http://localhost:8000/
```

That's it. The full live demo console will load with:
- ✅ Real interactive India map (MapLibre + OSM satellite tiles)
- ✅ 100+ real classified NASA FIRMS events as markers
- ✅ 9 industrial facility dots (Refineries: Jamnagar, Haldia, Panipat, etc.)
- ✅ Live event list with click-to-focus on map
- ✅ Real-time WebSocket stream of new classifications
- ✅ Backend health + worker status in the header
- ✅ Pipeline activity log

## What You Will See

1. **Top-left stats panel**: Total events, industrial, critical, agricultural counts
2. **Center map**: India centered at [82°E, 22°N] zoom 4
3. **Right panel**: List of 50 most recent events
4. **Right-bottom**: Pipeline activity log (real-time)

## To Restart the Backend (if needed)

```powershell
# In a regular terminal (not sandboxed):
cd V:\SIH26162
netstat -ano | findstr ":8000" | findstr LISTENING | ForEach-Object {
  $p = ($_ -split '\s+')[-1]
  Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
}
Start-Sleep 2
python -m apps.api.main
```

The worker will fetch 433 real NASA FIRMS hotspots within ~10 seconds and start classifying them.

## Key Files

| File | Purpose |
|---|---|
| `V:\SIH26162\demo.html` | Standalone HTML console (no Next.js, no cache) |
| `V:\SIH26162\apps\api\main.py` | Backend (serves demo.html at `/`) |
| `V:\SIH26162\apps\api\worker.py` | FIRMS polling + classification worker |
| `V:\SIH26162\apps\web\src\app\page.tsx` | Next.js landing page (alternative) |
| `V:\SIH26162\apps\web\src\components\TacticalMissionControl.tsx` | Next.js console (alternative) |

## Why demo.html Instead of Next.js?

The Next.js dev server has a `spawn EPERM` issue in this sandbox environment.
The standalone HTML bypasses Next.js entirely — it talks directly to the same
FastAPI backend. Same data, same real-time stream, but no build step required.
