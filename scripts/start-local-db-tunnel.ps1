# Forward localhost:15432 -> big-vps fleet-pgbouncer (store_trustecom).
# Run this before `npm run dev` when DATABASE_URL uses 127.0.0.1:15432.
$ErrorActionPreference = "Stop"

$localPort = 15432
$remoteHost = "10.0.1.8"
$remotePort = 6432
$sshHost = "big-vps"

$existing = Get-NetTCPConnection -LocalPort $localPort -State Listen -ErrorAction SilentlyContinue
if ($existing) {
  Write-Host "Port $localPort is already listening (tunnel likely running)."
  exit 0
}

Write-Host "Starting SSH tunnel: 127.0.0.1:$localPort -> ${remoteHost}:${remotePort} via $sshHost"
Start-Process ssh -ArgumentList @(
  "-N",
  "-L", "${localPort}:${remoteHost}:${remotePort}",
  $sshHost
) -WindowStyle Hidden

Start-Sleep -Seconds 2
$ok = (Test-NetConnection -ComputerName 127.0.0.1 -Port $localPort -WarningAction SilentlyContinue).TcpTestSucceeded
if (-not $ok) {
  Write-Error "Tunnel failed to bind on port $localPort."
  exit 1
}

Write-Host "Tunnel ready on 127.0.0.1:$localPort"
