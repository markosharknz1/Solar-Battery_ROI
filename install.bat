@echo off
cd /d "%~dp0"

set "INSTALLER="
for %%F in ("release\*Setup*.exe") do set "INSTALLER=%%F"

if not defined INSTALLER (
  echo No installer found in release\.
  echo Run build-and-install.bat first, or "npm run electron:build".
  pause
  exit /b 1
)

echo Installing: "%INSTALLER%"
echo This runs silently - no install wizard will appear.
"%INSTALLER%" /S

echo.
echo Done. Check your Start Menu / desktop for "Solar ^& Battery Advisor".
pause
