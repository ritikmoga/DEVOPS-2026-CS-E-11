$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$logDirectory = Join-Path $projectRoot 'logs'
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null

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
}

Start-Frontend -Name 'public-client' -Directory 'public-client' -Port 5173
Start-Frontend -Name 'admin-client' -Directory 'admin-client' -Port 5174

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
    Write-Error "One or both frontends did not start. Check logs in $logDirectory"
    exit 1
}

Write-Output 'Both frontends are ready:'
Write-Output 'Public: http://localhost:5173'
Write-Output 'Admin:  http://localhost:5174'
