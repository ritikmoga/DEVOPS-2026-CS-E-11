$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$logDirectory = Join-Path $projectRoot 'logs'
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
$launcherLogPath = Join-Path $logDirectory 'launcher.log'

function Write-LauncherLog {
    param([string]$Message)
    Add-Content -LiteralPath $launcherLogPath -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $Message"
}

$npmCommand = (Get-Command npm.cmd -ErrorAction Stop).Source

function Test-PortListening {
    param([int]$Port)
    return $null -ne (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
}

function Start-Frontend {
    param(
        [string]$Name,
        [string]$Directory,
        [int]$Port
    )

    if (Test-PortListening -Port $Port) {
        Write-Output "$Name is already running on http://localhost:$Port"
        Write-LauncherLog "$Name already running on port $Port"
        return
    }

    $logPath = Join-Path $logDirectory "$Name.log"
    $errorLogPath = Join-Path $logDirectory "$Name.error.log"
    $arguments = @('run', 'dev', '--', '--host', '127.0.0.1', '--port', $Port.ToString())

    Start-Process `
        -FilePath $npmCommand `
        -ArgumentList $arguments `
        -WorkingDirectory (Join-Path $projectRoot $Directory) `
        -WindowStyle Hidden `
        -RedirectStandardOutput $logPath `
        -RedirectStandardError $errorLogPath | Out-Null

    Write-Output "Starting $Name on http://localhost:$Port"
    Write-LauncherLog "Started $Name on port $Port"
}

Start-Frontend -Name 'public-client' -Directory 'frontend/public-client' -Port 5173
Start-Frontend -Name 'admin-client' -Directory 'frontend/admin-client' -Port 5174

$deadline = (Get-Date).AddSeconds(30)
do {
    $publicReady = Test-PortListening -Port 5173
    $adminReady = Test-PortListening -Port 5174
    if ($publicReady -and $adminReady) {
        break
    }
    Start-Sleep -Milliseconds 500
} while ((Get-Date) -lt $deadline)

if (-not (Test-PortListening -Port 5173) -or -not (Test-PortListening -Port 5174)) {
    Write-LauncherLog 'Frontend startup failed; check individual client logs.'
    Write-Error "One or both frontends did not start. Check logs in $logDirectory"
    exit 1
}

Write-Output 'Both frontends are ready:'
Write-Output 'Public: http://localhost:5173'
Write-Output 'Admin:  http://localhost:5174'
Start-Process 'http://localhost:5173'
Start-Process 'http://localhost:5174'
Write-LauncherLog 'Opened public and admin URLs in the default browser.'
