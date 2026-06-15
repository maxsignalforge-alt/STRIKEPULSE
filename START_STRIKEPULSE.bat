@echo off
setlocal
cd /d "%~dp0"

echo Starting STRIKEPULSE...
echo.

node -v >nul 2>nul
if %errorlevel%==0 (
  echo Starting backend on http://127.0.0.1:8787
  start "STRIKEPULSE Backend" cmd /k "cd /d %~dp0 && node backend/server.mjs"
) else if exist "%~dp0backend\server.py" (
  where py >nul 2>nul
  if %errorlevel%==0 (
    echo Node.js unavailable. Starting Python backend on http://127.0.0.1:8787
    start "STRIKEPULSE Backend" cmd /k "cd /d %~dp0 && py backend/server.py"
  ) else (
    echo Node.js unavailable and Python launcher not found. Backend will be skipped.
  )
) else (
  echo Node.js unavailable. Backend will be skipped.
)

where py >nul 2>nul
if %errorlevel%==0 (
  echo Starting frontend on http://127.0.0.1:4173
  start "STRIKEPULSE Frontend" cmd /k "cd /d %~dp0 && py -m http.server 4173 --bind 127.0.0.1"
  timeout /t 2 >nul
  start "" "http://127.0.0.1:4173/index.html"
  goto :done
)

where python >nul 2>nul
if %errorlevel%==0 (
  echo Starting frontend on http://127.0.0.1:4173
  start "STRIKEPULSE Frontend" cmd /k "cd /d %~dp0 && python -m http.server 4173 --bind 127.0.0.1"
  timeout /t 2 >nul
  start "" "http://127.0.0.1:4173/index.html"
  goto :done
)

echo Python was not found. Install Python or use VS Code Live Server.
pause

:done
echo.
echo If the browser does not open, go to:
echo http://127.0.0.1:4173/index.html
endlocal
