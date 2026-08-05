@echo off
cd /d "%~dp0"

echo This BUILDS the installer from source (needs Node.js) and then installs it.
echo If you only want to install the app, use the Setup .exe from the GitHub Releases page instead.
echo.
echo Building the latest installer - first run can take several minutes...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-installer.ps1"
if errorlevel 1 (
  echo Build failed - see errors above.
  pause
  exit /b 1
)

call install.bat
