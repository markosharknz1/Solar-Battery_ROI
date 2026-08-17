@echo off
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo ==============================================================
  echo   STOP - this script is for developers. It BUILDS the app
  echo   from source code, which needs Node.js ^(not installed here^).
  echo.
  echo   To simply INSTALL AND USE the app you do not need this ZIP
  echo   at all. Download the ready-made installer - the Setup .exe
  echo   file - from the project's Releases page ^(sign in to GitHub
  echo   first^):
  echo.
  echo   https://github.com/markosharknz1/Solar-Battery_ROI/releases/latest
  echo.
  echo   Opening that page in your browser now...
  echo ==============================================================
  start "" "https://github.com/markosharknz1/Solar-Battery_ROI/releases/latest"
  pause
  exit /b 1
)

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
