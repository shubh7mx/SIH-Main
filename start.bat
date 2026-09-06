@echo off
setlocal enabledelayedexpansion
title SIH26162 - Sovereign Thermal Intelligence Mission Control

:menu
cls
echo ===============================================================================
echo        SIH26162 -- SOVEREIGN THERMAL INTELLIGENCE MISSION CONTROL
echo        AI Detection ^& Classification of Industrial Thermal Hazards (NTRO)
echo ===============================================================================
echo.
echo   [1] Start Full Stack     (FastAPI Backend :8000 + Next.js Web GUI :3000)
echo   [2] Start Backend Only   (FastAPI Swarm Engine on :8000)
echo   [3] Start Frontend Only  (Next.js Tactical Console on :3000)
echo   [4] Retrain ML Model     (Train XGBoost + Random Forest on Real FIRMS Data)
echo   [5] System Health Check  (^& Live WebSocket / Swarm Diagnostics)
echo   [6] Stop All Services    (Free Ports 8000 ^& 3000)
echo   [0] Exit
echo.
set /p choice="Select option [0-6]: "

if "%choice%"=="1" goto start_all
if "%choice%"=="2" goto start_backend
if "%choice%"=="3" goto start_frontend
if "%choice%"=="4" goto train_ml
if "%choice%"=="5" goto diagnostics
if "%choice%"=="6" goto stop_all
if "%choice%"=="0" goto exit_app
goto menu

:start_all
cls
echo Starting FastAPI Backend (6-Agent Swarm + FIRMS Poller)...
start "SIH26162 Backend (:8000)" cmd /k "python -m uvicorn apps.api.main:app --host 0.0.0.0 --port 8000"
timeout /t 3 /nobreak >nul

echo Starting Next.js Tactical Web Console...
cd apps\web
start "SIH26162 Frontend (:3000)" cmd /k "pnpm dev"
cd ..\..

echo.
echo ===============================================================================
echo   Mission Control Launched!
echo   - Tactical Dashboard: http://localhost:3000/dashboard
echo   - Live Map:           http://localhost:3000/map
echo   - ML Model Analytics: http://localhost:3000/model-validation
echo   - AI Copilot:         http://localhost:3000/copilot
echo   - API Swagger Docs:   http://127.0.0.1:8000/docs
echo ===============================================================================
echo.
pause
goto menu

:start_backend
cls
echo Starting FastAPI Backend (:8000)...
python -m uvicorn apps.api.main:app --host 0.0.0.0 --port 8000
pause
goto menu

:start_frontend
cls
echo Starting Next.js Tactical Web Dashboard (:3000)...
cd apps\web
pnpm dev
cd ..\..
pause
goto menu

:train_ml
cls
echo ===============================================================================
echo   Training Multi-Modal Geospatial AI Ensemble (XGBoost 300 + Random Forest 250)
echo   Data: Real VIIRS Detections + OSM Infrastructure Distances + CDE Baselines
echo ===============================================================================
echo.
python scripts/train_real_ensemble.py
echo.
echo Validation metrics and SHAP explainability chart exported.
echo.
pause
goto menu

:diagnostics
cls
echo ===============================================================================
echo   Checking SIH26162 Subsystems & Telemetry Health...
echo ===============================================================================
echo.
powershell -Command "try { $h = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/health' -TimeoutSec 3; Write-Host '[OK] FastAPI Backend:' $h.status -ForegroundColor Green; Write-Host '     Active Events In Store:' $h.components.event_store.events_stored -ForegroundColor Cyan } catch { Write-Host '[FAIL] FastAPI Backend is OFFLINE on port 8000' -ForegroundColor Red }"
powershell -Command "try { $w = Invoke-WebRequest -Uri 'http://localhost:3000' -TimeoutSec 3 -UseBasicParsing; Write-Host '[OK] Next.js Web Console: ONLINE (HTTP ' $w.StatusCode ')' -ForegroundColor Green } catch { Write-Host '[FAIL] Next.js Web Console is OFFLINE on port 3000' -ForegroundColor Red }"
powershell -Command "try { $m = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/analytics/model-validation' -TimeoutSec 3; Write-Host '[OK] ML Model Ensemble:' $m.model_name ' (Accuracy: ' $m.accuracy_pct '%)' -ForegroundColor Green } catch { Write-Host '[WARN] ML Model metrics endpoint unreachable' -ForegroundColor Yellow }"
echo.
pause
goto menu

:stop_all
cls
echo Stopping services on ports 8000 and 3000...
powershell -Command "$conns = Get-NetTCPConnection -LocalPort 8000,3000 -State Listen -ErrorAction SilentlyContinue; if ($conns) { $conns | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }; Write-Host 'Services on ports 8000 and 3000 stopped.' -ForegroundColor Green } else { Write-Host 'No active services running on ports 8000 / 3000.' -ForegroundColor Yellow }"
timeout /t 2 /nobreak >nul
goto menu

:exit_app
exit /b 0
