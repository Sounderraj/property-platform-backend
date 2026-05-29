# Test CRM webhook against live or local API
# Usage:
#   $env:CRM_WEBHOOK_SECRET = "your-render-secret"
#   .\scripts\test-webhook.ps1 -EnquiryId "uuid-from-create-enquiry"

param(
  [string]$BaseUrl = "https://property-platform-api.onrender.com",
  [Parameter(Mandatory = $true)][string]$EnquiryId,
  [string]$Secret = $env:CRM_WEBHOOK_SECRET
)

if (-not $Secret) {
  Write-Error "Set CRM_WEBHOOK_SECRET env var or pass -Secret"
  exit 1
}

$body = "{`"event`":`"enquiry.synced`",`"enquiryId`":`"$EnquiryId`",`"externalId`":`"CRM-12345`"}"

$hmac = New-Object System.Security.Cryptography.HMACSHA256
$hmac.Key = [Text.Encoding]::UTF8.GetBytes($Secret)
$hash = $hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($body))
$signature = -join ($hash | ForEach-Object { $_.ToString("x2") })

Write-Host "Body: $body"
Write-Host "Signature: $signature"

$response = Invoke-RestMethod -Method POST `
  -Uri "$BaseUrl/api/webhook/crm" `
  -ContentType "application/json" `
  -Headers @{ "X-Webhook-Signature" = $signature } `
  -Body $body

$response | ConvertTo-Json -Depth 5
