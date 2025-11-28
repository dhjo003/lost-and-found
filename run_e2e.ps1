param(
    [int]$BackendPort = 5298,
    [int]$FrontendPort = 5173,
    [int]$TimeoutSeconds = 60
)

function Wait-ForUrl {
    param($Url, $TimeoutSeconds)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -Method Get -TimeoutSec 5 -ErrorAction Stop
            if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400) { return $true }
        } catch { }
        Start-Sleep -Seconds 1
    }
    return $false
}

$backendUrl = "http://localhost:$BackendPort"
$frontendUrl = "http://localhost:$FrontendPort"

Write-Host "Waiting for frontend at $frontendUrl (timeout ${TimeoutSeconds}s)..."
if (-not (Wait-ForUrl -Url $frontendUrl -TimeoutSeconds $TimeoutSeconds)) {
    Write-Error "Frontend did not respond at $frontendUrl"
    exit 2
}
Write-Host "Frontend is up."

Write-Host "Verifying backend test token endpoint..."
& "$PSScriptRoot\backend\get_test_token.ps1"
if (-not $?) {
    Write-Error "Backend token endpoint check failed"
    exit 3
}

Write-Host "Running Playwright E2E..."
Push-Location "$PSScriptRoot\frontend\lostfound-client"
try {
    Write-Host 'Executing: npx playwright test tests/create-item.spec.js --trace on'
    & npx playwright test tests/create-item.spec.js --trace on
    $code = $LASTEXITCODE
} finally {
    Pop-Location
}
exit $code
