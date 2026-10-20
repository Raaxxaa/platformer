@echo off
rem Double-click to start the RUSHBLADE company controller. Leave this window open.
cd /d "%~dp0\.."
python company\company.py doctor
if errorlevel 1 (
  echo.
  echo Fix the problems above, then double-click start.cmd again.
  pause
  exit /b 1
)
python company\company.py run
pause
