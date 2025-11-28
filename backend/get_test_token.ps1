$body = '{"email":"e2e+user@example.com","displayName":"E2E User"}'
try {
    $resp = Invoke-RestMethod -Method Post -Uri 'http://localhost:5298/api/test/token' -ContentType 'application/json' -Body $body -ErrorAction Stop
    Write-Output "RESPONSE: $($resp | ConvertTo-Json -Depth 5)"
} catch {
    Write-Output "Request failed: $($_.Exception.Message)"
    exit 1
}
