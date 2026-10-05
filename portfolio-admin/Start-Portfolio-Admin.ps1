$ErrorActionPreference = 'Stop'
$dashboardUrl = 'http://127.0.0.1:4318'
$dashboardReady = $false
try {
    $existing = Invoke-RestMethod -Uri "$dashboardUrl/api/session" -TimeoutSec 2
    $dashboardReady = $existing.app -eq 'abanoub-portfolio-admin'
} catch {}
if (-not $dashboardReady) {
    $nodePath = (Get-Command node -ErrorAction Stop).Source
    $serverPath = Join-Path $PSScriptRoot 'server.cjs'
    Start-Process -FilePath $nodePath -ArgumentList ('"' + $serverPath + '"') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        Start-Sleep -Milliseconds 300
        try {
            $session = Invoke-RestMethod -Uri "$dashboardUrl/api/session" -TimeoutSec 2
            if ($session.app -eq 'abanoub-portfolio-admin') { $dashboardReady = $true; break }
        } catch {}
    }
}
if (-not $dashboardReady) { throw 'Could not start the dashboard. Port 4318 may be in use.' }
$setupPath = Join-Path $PSScriptRoot '.private\setup-key'
if (Test-Path -LiteralPath $setupPath) {
    $setupKey = [System.IO.File]::ReadAllText($setupPath).Trim()
    $dashboardUrl += '/#setup=' + $setupKey
}
Start-Process $dashboardUrl
