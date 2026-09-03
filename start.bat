@echo off
setlocal enabledelayedexpansion
title SIH26162 - Thermal Intelligence Mission Control

:menu
cls
echo ===============================================================================
echo        SIH26162 -- THERMAL INTELLIGENCE MISSION CONTROL SYSTEM
echo        Autonomous Detection ^& Classification of Industrial Thermal Hazards
echo ===============================================================================
echo.
echo   [1] Start Full Stack   (FastAPI Backend :8000 + Next.js Web GUI :3000)
echo   [2] Start Backend Only (FastAPI API on :8000)
echo   [3] Start Frontend Only(Next.js Dashboard on :3000)
echo   [4] System Health Check ^& Diagnostics
echo   [5] Reseed India Hotspots Database
echo   [6] Stop All Services  (Free Ports 8000 ^& 3000)
echo   [0] Exit
echo.
set /p choice="Select option [0-6]: "

if "%choice%"=="1" goto start_all
if "%choice%"=="2" goto start_backend
if "%choice%"=="3" goto start_frontend
if "%choice%"=="4" goto diagnostics
if "%choice%"=="5" goto reseed
if "%choice%"=="6" goto stop_all
if "%choice%"=="0" goto exit_app
goto menu

:start_all
cls
echo Starting FastAPI Backend in background...
start "SIH26162 Backend (:8000)" cmd /k "python -m uvicorn apps.api.main:app --host 0.0.0.0 --port 8000"
timeout /t 3 /nobreak >nul

echo Starting Next.js Web Dashboard...
cd apps\web
start "SIH26162 Frontend (:3000)" cmd /k "node standalone-dev.js"
cd ..\..

echo.
echo ================================================================
echo   Services Launched!
echo   - Web GUI:   http://localhost:3000
echo   - Live Map:  http://localhost:3000/map
echo   - API Docs:  http://127.0.0.1:8000/docs
echo ================================================================
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
echo Starting Next.js Web Dashboard (:3000)...
cd apps\web
node standalone-dev.js
cd ..\..
pause
goto menu

:diagnostics
cls
echo Checking services...
powershell -Command "try { $h = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/v1/health' -TimeoutSec 3; Write-Host 'Backend Status:' $h.status -ForegroundColor Green; Write-Host 'Stored Events:' $h.components.event_store.events_stored -ForegroundColor Cyan } catch { Write-Host 'Backend is OFFLINE' -ForegroundColor Red }"
powershell -Command "try { $w = Invoke-WebRequest -Uri 'http://localhost:3000' -TimeoutSec 3 -UseBasicParsing; Write-Host 'Frontend Status:' $w.StatusCode -ForegroundColor Green } catch { Write-Host 'Frontend is OFFLINE' -ForegroundColor Red }"
echo.
pause
goto menu

:reseed
cls
echo Reseeding thermal hotspot events...
powershell -Command "try { $r = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/v1/events/reseed' -Method POST -TimeoutSec 10; Write-Host 'Success:' $r.message -ForegroundColor Green } catch { Write-Host 'Error (is backend running?):' $_.Exception.Message -ForegroundColor Red }"
echo.
pause
goto menu

:stop_all
cls
echo Stopping services on ports 8000 and 3000...
powershell -Command "$conns = Get-NetTCPConnection -LocalPort 8000,3000 -State Listen -ErrorAction SilentlyContinue; if ($conns) { $conns | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }; Write-Host 'Services stopped.' -ForegroundColor Green } else { Write-Host 'No services running.' -ForegroundColor Yellow }"
timeout /t 2 /nobreak >nul
goto menu

:exit_app
exit /b 0
