$ErrorActionPreference = 'Stop'
$appDir = $PSScriptRoot
$tempOut = Join-Path $env:TEMP "sba-electron-build"
Set-Location $appDir

# This is a BUILD script for developers - it needs Node.js and takes minutes. If you just
# want to install the app on a PC, download the Setup .exe from the GitHub Releases page
# instead; it is fully self-contained and needs none of this.
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js is required to BUILD the app but was not found." -ForegroundColor Red
    Write-Host "To just INSTALL the app, download the Setup .exe from the repo's Releases page instead - it needs nothing else." -ForegroundColor Yellow
    Write-Host "To build from source, install Node.js from https://nodejs.org first."
    Read-Host "Press Enter to close"
    exit 1
}

if (-not (Test-Path (Join-Path $appDir 'node_modules'))) {
    Write-Host "Dependencies not installed yet - running npm install (first run only, takes a few minutes)..."
    npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
}

Write-Host "Building web app..."
npm run build
if ($LASTEXITCODE -ne 0) { throw "Web build failed" }

if (Test-Path $tempOut) { Remove-Item $tempOut -Recurse -Force }

# Packaged to a temp directory on purpose - electron-builder's unpack-then-rename step
# can hit an EPERM when the output lives inside the project tree (something holds a
# transient lock on freshly-extracted folders). The finished installer is copied back after.
Write-Host "Packaging installer..."
& "$appDir\node_modules\.bin\electron-builder.cmd" --win --x64 --config.directories.output=$tempOut
if ($LASTEXITCODE -ne 0) { throw "electron-builder failed" }

$installer = Get-ChildItem $tempOut -Filter "*Setup*.exe" | Select-Object -First 1
if (-not $installer) { throw "No installer .exe found in $tempOut" }

$releaseDir = Join-Path $appDir "release"
New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
Copy-Item $installer.FullName -Destination $releaseDir -Force
Write-Host "Installer ready: $releaseDir\$($installer.Name)"

Remove-Item $tempOut -Recurse -Force
