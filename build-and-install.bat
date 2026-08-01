@echo off
cd /d "%~dp0"

echo Building the latest installer - this can take a minute or two...
call npm run electron:build
if errorlevel 1 (
  echo Build failed - see errors above.
  pause
  exit /b 1
)

call install.bat
