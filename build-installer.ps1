$ErrorActionPreference = 'Stop'
$appDir = "C:\Claude\PowerBudget"
$tempOut = Join-Path $env:TEMP "sba-electron-build"
Set-Location $appDir

Write-Host "Building web app..."
npm run build
if ($LASTEXITCODE -ne 0) { throw "Web build failed" }

if (Test-Path $tempOut) { Remove-Item $tempOut -Recurse -Force }

# Packaged outside C:\Claude on purpose - electron-builder's unpack-then-rename step
# consistently hits an EPERM on this machine when the output lives under C:\Claude
# (something holds a transient lock on freshly-extracted folders there specifically).
# Building to a temp location sidesteps it; the finished installer is copied back after.
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
