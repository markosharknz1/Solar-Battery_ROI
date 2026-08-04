$ErrorActionPreference = 'Stop'
$appDir = $PSScriptRoot
Set-Location $appDir

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
