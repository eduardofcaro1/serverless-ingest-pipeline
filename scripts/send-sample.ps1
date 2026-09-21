param(
  [string]$ApiUrl = $(if ($env:API_URL) { $env:API_URL } else { 'http://localhost:3000' }),
  [string]$ApiKey = $(if ($env:API_KEY) { $env:API_KEY } else { 'local-dev-key' })
)

$payload = @{
  readings = @(
    @{
      idempotencyKey = [guid]::NewGuid().ToString()
      deviceId       = 'sensor-01'
      metric         = 'temperature'
      value          = 78.8
      unit           = 'F'
      recordedAt     = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    }
  )
} | ConvertTo-Json -Depth 5

function Send-Batch {
  try {
    $response = Invoke-WebRequest -Uri "$ApiUrl/readings" -Method Post `
      -Headers @{ 'x-api-key' = $ApiKey } -ContentType 'application/json' `
      -Body $payload -UseBasicParsing
    $status = [int]$response.StatusCode
    $content = $response.Content
  }
  catch {
    $errorResponse = $_.Exception.Response
    if (-not $errorResponse) { throw }
    $status = [int]$errorResponse.StatusCode
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
      $content = $_.ErrorDetails.Message
    }
    else {
      $content = (New-Object System.IO.StreamReader($errorResponse.GetResponseStream())).ReadToEnd()
    }
  }

  Write-Host $content
  Write-Host "HTTP $status"
}

Write-Host 'First request:'
Send-Batch
Write-Host ''
Write-Host 'Same request again (should be reported as a duplicate):'
Send-Batch
