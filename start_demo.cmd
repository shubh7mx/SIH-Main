@echo off
REM SIH26162 — One-click demo starter
REM Run this in a regular PowerShell/cmd terminal (NOT from sandboxed sessions)

echo.
echo ============================================================
echo  SIH26162 Demo Starter
echo ============================================================
echo.

REM 1. Stop any existing servers
echo [1/4] Stopping any existing servers on ports 3000/8000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " ^| findstr LISTENING') do (
  echo    Killing PID %%a on port 3000
  taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000 " ^| findstr LISTENING') do (
  echo    Killing PID %%a on port 8000
  taskkill /F /PID %%a >nul 2>&1
)
timeout /t 2 /nobreak >nul

REM 2. Clear Next.js cache
echo.
echo [2/4] Clearing Next.js cache...
cd /d %~dp0apps\web
if exist .next rmdir /s /q .next
echo    Cache cleared.

REM 3. Start backend
echo.
echo [3/4] Starting backend on http://localhost:8000 ...
cd /d %~dp0
start "SIH-Backend" cmd /k "python -m apps.api.main"
timeout /t 5 /nobreak >nul

REM 4. Start frontend
echo.
echo [4/4] Starting frontend on http://localhost:3000 ...
cd apps\web
start "SIH-Frontend" cmd /k "npm run dev"
echo.
echo ============================================================
echo  Both servers starting...
echo  Backend:  http://localhost:8000
echo  Frontend: http://localhost:3000
echo.
echo  Hard-refresh the browser with Ctrl+Shift+R after the
echo  frontend finishes compiling (about 15 seconds).
echo ============================================================
echo.
pause
