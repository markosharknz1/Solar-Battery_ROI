# Builds the no-executable release ZIP: dist\ + launcher.cjs + the .cmd +
# the official signed node.exe. No exe of ours, no PowerShell, no installers -
# nothing for SmartScreen / Smart App Control to flag.
# Output: release\Solar-Battery-Advisor-v<version>.zip
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$NodeVersion = '24.21.0'   # official LTS line; bump deliberately, not casually

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Node.js is required to build (npm run build).'
}

Write-Host 'Building app (tsc + vite)...'
npm run build
if ($LASTEXITCODE -ne 0) { throw 'npm run build failed' }

# --- Official Node runtime, downloaded once and cached, checksum-verified ---
$cacheDir = Join-Path $env:TEMP 'sba-node-runtime-cache'
New-Item -ItemType Directory -Force $cacheDir | Out-Null
$nodeZipName = "node-v$NodeVersion-win-x64.zip"
$nodeZipPath = Join-Path $cacheDir $nodeZipName
$shaPath = Join-Path $cacheDir "SHASUMS256-v$NodeVersion.txt"

if (-not (Test-Path $nodeZipPath)) {
    Write-Host "Downloading official Node.js runtime $nodeZipName ..."
    Invoke-WebRequest "https://nodejs.org/dist/v$NodeVersion/$nodeZipName" -OutFile $nodeZipPath
}
if (-not (Test-Path $shaPath)) {
    Invoke-WebRequest "https://nodejs.org/dist/v$NodeVersion/SHASUMS256.txt" -OutFile $shaPath
}
$expected = (Select-String -Path $shaPath -Pattern ([regex]::Escape($nodeZipName))).Line.Split(' ')[0]
$actual = (Get-FileHash $nodeZipPath -Algorithm SHA256).Hash.ToLower()
if ($actual -ne $expected) { throw "Node runtime checksum mismatch: expected $expected got $actual" }
Write-Host "Node runtime checksum OK ($actual)"

$nodeExtract = Join-Path $cacheDir "node-v$NodeVersion-win-x64"
if (-not (Test-Path (Join-Path $nodeExtract 'node.exe'))) {
    Expand-Archive $nodeZipPath -DestinationPath $cacheDir -Force
}

# --- Stage ---
$version = (Get-Content package.json | ConvertFrom-Json).version
$stage = Join-Path $env:TEMP 'sba-zip-stage'
if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }
$appDir = Join-Path $stage 'Solar & Battery Advisor'
New-Item -ItemType Directory -Force (Join-Path $appDir 'node') | Out-Null

Copy-Item -Recurse dist (Join-Path $appDir 'dist')
Copy-Item launcher.cjs $appDir
Copy-Item 'Solar & Battery Advisor.cmd' $appDir
Copy-Item (Join-Path $nodeExtract 'node.exe') (Join-Path $appDir 'node')
Copy-Item (Join-Path $nodeExtract 'LICENSE') (Join-Path $appDir 'node')

@"
Solar & Battery Advisor $version
================================

To start the app: double-click "Solar & Battery Advisor.cmd".
(First time on a new PC: right-click the downloaded ZIP -> Properties ->
tick Unblock -> OK, BEFORE extracting.)

Your data (tariff plans, battery quotes, VPP programs, settings) is saved in
the .edge-app-profile folder that appears next to this file, and never leaves
this computer.

To upgrade: extract a newer ZIP over this folder (keep .edge-app-profile).
To move the app: move this whole folder - data moves with it.
To uninstall: delete this folder. That's everything.

What's in this download: the app's built web files (dist\), a small launcher
run by the official Node.js runtime (node\node.exe, signed by the OpenJS
Foundation), and the .cmd you double-click. The app window itself is the
Microsoft Edge (or Google Chrome) already on your computer, in app mode.
No installer, nothing is written outside this folder.
"@ | Out-File -Encoding utf8 (Join-Path $appDir 'README.txt')

New-Item -ItemType Directory -Force release | Out-Null
$zipOut = Join-Path $PSScriptRoot "release\Solar-Battery-Advisor-v$version.zip"
if (Test-Path $zipOut) { Remove-Item -Force $zipOut }
Compress-Archive -Path $appDir -DestinationPath $zipOut
$zipHash = (Get-FileHash $zipOut -Algorithm SHA256).Hash.ToLower()
Write-Host "ZIP ready: $zipOut"
Write-Host "SHA256: $zipHash"
