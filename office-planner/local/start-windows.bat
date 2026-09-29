@echo off
rem Office sales planner - local launcher (no Python needed)
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
if errorlevel 1 (
  echo.
  echo Server did not start. You can open index.html directly with a double click.
  start "" "%~dp0index.html"
)
pause
