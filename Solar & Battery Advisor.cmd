@echo off
REM Solar & Battery Advisor - double-click to start. Hands straight over to
REM Node.js (the official signed runtime in this folder's node\ subfolder -
REM or, if that's missing, the Node.js installed on this computer) running
REM launcher.cjs, which opens the app in its own window. conhost --headless
REM gives it no console window; this window closes immediately.
REM
REM This is the only script in the download. Everything else is run by
REM node.exe (signed by the OpenJS Foundation) and the Microsoft Edge or
REM Google Chrome already on the computer.
setlocal
set "NODE=%~dp0node\node.exe"
if not exist "%NODE%" set "NODE=%ProgramFiles%\nodejs\node.exe"
if not exist "%NODE%" (
    echo Solar ^& Battery Advisor needs Node.js, and neither the node\ folder
    echo of this download nor an installed Node.js was found.
    echo.
    echo Download the full ZIP from the Releases page, or install Node.js LTS
    echo from https://nodejs.org and try again.
    echo.
    pause
    exit /b 1
)
start "" "%SystemRoot%\System32\conhost.exe" --headless "%NODE%" "%~dp0launcher.cjs"
