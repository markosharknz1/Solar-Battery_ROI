$ErrorActionPreference = 'Stop'
$appDir = $PSScriptRoot
Set-Location $appDir

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js is required to run from source but was not found - install it from https://nodejs.org," -ForegroundColor Red
    Write-Host "or just install the app via the Setup .exe from the repo's Releases page instead." -ForegroundColor Yellow
    Read-Host "Press Enter to close"
    exit 1
}

if (-not (Test-Path (Join-Path $appDir 'node_modules'))) {
    Write-Host "Dependencies not installed yet - running npm install (first run only, takes a few minutes)..."
    npm install
    if ($LASTEXITCODE -ne 0) {
        Read-Host "npm install failed - press Enter to close"
        exit 1
    }
}

Write-Host "Building latest version..."
& npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed - see errors above." -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit 1
}

Write-Host "Starting server..."
$logFile = Join-Path $env:TEMP "solar-battery-advisor-preview.log"
Remove-Item $logFile -ErrorAction SilentlyContinue
Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c", "npm run preview -- --port 5184 > `"$logFile`" 2>&1" `
    -WorkingDirectory $appDir -WindowStyle Hidden | Out-Null

$url = $null
for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 500
    if (Test-Path $logFile) {
        $content = Get-Content $logFile -Raw -ErrorAction SilentlyContinue
        if ($content -match 'Local:\s+(http://localhost:\d+/)') {
            $url = $matches[1]
            break
        }
    }
}

if (-not $url) {
    $url = "http://localhost:5184"
    Write-Host "Couldn't confirm the server started in time - trying $url anyway."
}

Write-Host "Opening $url"
Start-Process $url
