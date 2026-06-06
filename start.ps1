# CONDR Faceit - Auto-start script
# Starts backend, frontend, cloudflare tunnel, and updates all URLs automatically

$BOT_TOKEN = "8770786824:AAEsIV_eRevHKUBHDdyATymBpWVEfKBrECI"
$ROOT = "C:\Users\Admin\Claude\condr_faceit"

Write-Host "=== CONDR Faceit Launcher ===" -ForegroundColor Cyan

# 1. Kill existing processes
Write-Host "`n[1/5] Stopping old processes..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

# 2. Start backend
Write-Host "[2/5] Starting backend (port 4000)..." -ForegroundColor Yellow
$backend = Start-Process -NoNewWindow -FilePath "npx" `
  -ArgumentList "ts-node -r tsconfig-paths/register src/main.ts" `
  -WorkingDirectory "$ROOT\backend" `
  -RedirectStandardOutput "$ROOT\backend\server.log" `
  -RedirectStandardError "$ROOT\backend\server_err.log" `
  -PassThru
Start-Sleep -Seconds 6
$backendRunning = Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue
if ($backendRunning) {
  Write-Host "  Backend OK (port 4000)" -ForegroundColor Green
} else {
  Write-Host "  Backend FAILED - check backend\server_err.log" -ForegroundColor Red
}

# 3. Start frontend
Write-Host "[3/5] Starting frontend (port 3000)..." -ForegroundColor Yellow
$frontend = Start-Process -NoNewWindow -FilePath "npm" `
  -ArgumentList "run dev" `
  -WorkingDirectory "$ROOT\frontend" `
  -RedirectStandardOutput "$ROOT\frontend\frontend.log" `
  -RedirectStandardError "$ROOT\frontend\frontend_err.log" `
  -PassThru
Start-Sleep -Seconds 8
$frontendRunning = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($frontendRunning) {
  Write-Host "  Frontend OK (port 3000)" -ForegroundColor Green
} else {
  Write-Host "  Frontend FAILED - check frontend\frontend_err.log" -ForegroundColor Red
}

# 4. Start cloudflare tunnel and grab URL
Write-Host "[4/5] Starting Cloudflare tunnel..." -ForegroundColor Yellow
$tunnelLog = "$ROOT\tunnel.log"
if (Test-Path $tunnelLog) { Remove-Item $tunnelLog -Force }

$tunnel = Start-Process -NoNewWindow -FilePath "$ROOT\cloudflared.exe" `
  -ArgumentList "tunnel --url http://localhost:3000" `
  -RedirectStandardOutput $tunnelLog `
  -RedirectStandardError "$ROOT\tunnel_err.log" `
  -PassThru

# Wait for URL to appear in log
$publicUrl = $null
$maxWait = 20
$waited = 0
while (-not $publicUrl -and $waited -lt $maxWait) {
  Start-Sleep -Seconds 1
  $waited++
  if (Test-Path $tunnelLog) {
    $content = Get-Content $tunnelLog -Raw -ErrorAction SilentlyContinue
    if ($content -match 'https://[a-z0-9-]+\.trycloudflare\.com') {
      $publicUrl = $matches[0]
    }
  }
  if (-not $publicUrl -and (Test-Path "$ROOT\tunnel_err.log")) {
    $content = Get-Content "$ROOT\tunnel_err.log" -Raw -ErrorAction SilentlyContinue
    if ($content -match 'https://[a-z0-9-]+\.trycloudflare\.com') {
      $publicUrl = $matches[0]
    }
  }
}

if (-not $publicUrl) {
  Write-Host "  Tunnel FAILED - could not get URL" -ForegroundColor Red
  exit 1
}

Write-Host "  Tunnel URL: $publicUrl" -ForegroundColor Green

# 5. Update .env and register webhook + bot button
Write-Host "[5/5] Updating URLs..." -ForegroundColor Yellow

# Update .env
$envPath = "$ROOT\backend\.env"
$envContent = Get-Content $envPath -Raw
$envContent = $envContent -replace 'PUBLIC_URL=.*', "PUBLIC_URL=$publicUrl"
Set-Content $envPath $envContent -Encoding UTF8
Write-Host "  .env updated" -ForegroundColor Green

# Register Telegram webhook (with retry)
$webhookUrl = "$publicUrl/api/coins/webhook"
$body = "{`"url`":`"$webhookUrl`"}"
$webhookOk = $false
for ($attempt = 1; $attempt -le 3; $attempt++) {
  try {
    $result = Invoke-RestMethod -Uri "https://api.telegram.org/bot$BOT_TOKEN/setWebhook" `
      -Method POST -ContentType "application/json" -Body $body
    if ($result.ok) {
      Write-Host "  Webhook set: $webhookUrl" -ForegroundColor Green
      $webhookOk = $true
      break
    }
  } catch {
    Write-Host "  Webhook attempt $attempt failed: $_" -ForegroundColor Yellow
    Start-Sleep -Seconds 2
  }
}
if (-not $webhookOk) {
  Write-Host "  Webhook FAILED after 3 attempts" -ForegroundColor Red
}

# Verify webhook was accepted
try {
  $info = Invoke-RestMethod -Uri "https://api.telegram.org/bot$BOT_TOKEN/getWebhookInfo" -Method GET
  if ($info.result.url -eq $webhookUrl) {
    Write-Host "  Webhook verified OK" -ForegroundColor Green
  } else {
    Write-Host "  Webhook mismatch! Got: $($info.result.url)" -ForegroundColor Red
  }
} catch {}

# Update bot menu button
$menuBody = "{`"menu_button`":{`"type`":`"web_app`",`"text`":`"Play`",`"web_app`":{`"url`":`"$publicUrl`"}}}"
try {
  $result = Invoke-RestMethod -Uri "https://api.telegram.org/bot$BOT_TOKEN/setChatMenuButton" `
    -Method POST -ContentType "application/json" -Body $menuBody
  if ($result.ok) {
    Write-Host "  Bot menu button updated" -ForegroundColor Green
  }
} catch {
  Write-Host "  Bot button update FAILED: $_" -ForegroundColor Red
}

Write-Host "`n=== ALL DONE ===" -ForegroundColor Cyan
Write-Host "App URL: $publicUrl" -ForegroundColor White
Write-Host "Open this URL in Telegram or send it to users" -ForegroundColor Gray
Write-Host "`nPress Ctrl+C to stop all services" -ForegroundColor Gray

# Keep window open
Wait-Process -Id $tunnel.Id
