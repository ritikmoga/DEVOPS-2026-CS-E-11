param(
    [int]$JenkinsPort = 8080,
    [int]$RetryDelaySeconds = 10
)

$ErrorActionPreference = 'Stop'

$javaPath = 'C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot\bin\java.exe'
$warPath = 'C:\Users\RITIK\Downloads\jenkins.war'
$jenkinsHome = 'C:\Users\RITIK\.jenkins'
$logDirectory = 'C:\tmp'
$jenkinsStdout = Join-Path $logDirectory 'jenkins.stdout.log'
$jenkinsStderr = Join-Path $logDirectory 'jenkins.stderr.log'
$tunnelLog = Join-Path $logDirectory 'jenkins-localhost-run.log'
$tunnelErrorLog = Join-Path $logDirectory 'jenkins-localhost-run.error.log'
$supervisorLog = Join-Path $logDirectory 'jenkins-webhook-supervisor.log'
$repository = 'ritikmoga/DEVOPS-2026-CS-E-11'

function Test-JenkinsReady {
    try {
        return (Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$JenkinsPort/login" -TimeoutSec 5).StatusCode -eq 200
    } catch {
        return $false
    }
}

function Start-JenkinsIfNeeded {
    if (Test-JenkinsReady) {
        return
    }

    if (-not (Test-Path -LiteralPath $javaPath) -or -not (Test-Path -LiteralPath $warPath)) {
        throw 'Jenkins cannot start because java.exe or jenkins.war is missing. Update this script with the installed paths.'
    }

    Start-Process `
        -FilePath $javaPath `
        -ArgumentList @('-Xms256m', '-Xmx512m', "-DJENKINS_HOME=$jenkinsHome", '-jar', $warPath, "--httpPort=$JenkinsPort") `
        -WorkingDirectory (Split-Path -Parent $warPath) `
        -WindowStyle Hidden `
        -RedirectStandardOutput $jenkinsStdout `
        -RedirectStandardError $jenkinsStderr

    foreach ($attempt in 1..30) {
        if (Test-JenkinsReady) {
            return
        }
        Start-Sleep -Seconds 2
    }

    throw "Jenkins did not become ready on port $JenkinsPort. Check $jenkinsStderr."
}

function Update-GitHubWebhook([string]$publicUrl) {
    $payloadUrl = "$publicUrl/github-webhook/"
    & gh api --method PATCH "repos/$repository/hooks/669796074" `
        -f "config[url]=$payloadUrl" `
        -f 'config[content_type]=json' `
        -f 'config[insecure_ssl]=0' | Out-Null

    if ($LASTEXITCODE -ne 0) {
        throw 'Could not update the GitHub webhook. Run gh auth login (with admin:repo_hook) in this Windows user session.'
    }
}

New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
Start-JenkinsIfNeeded

while ($true) {
    try {
        $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
        "[$timestamp] Starting localhost.run tunnel for Jenkins on port $JenkinsPort." | Set-Content -LiteralPath $tunnelLog
        $tunnel = Start-Process `
            -FilePath 'ssh.exe' `
            -ArgumentList @('-o', 'StrictHostKeyChecking=no', '-o', 'ServerAliveInterval=30', '-o', 'ServerAliveCountMax=3', '-R', "80:localhost:$JenkinsPort", 'nokey@localhost.run') `
            -WindowStyle Hidden `
            -RedirectStandardOutput $tunnelLog `
            -RedirectStandardError $tunnelErrorLog `
            -PassThru

        $publicUrl = $null
        foreach ($attempt in 1..30) {
            Start-Sleep -Seconds 2
            $content = (Get-Content -LiteralPath $tunnelLog -Raw -ErrorAction SilentlyContinue) +
                (Get-Content -LiteralPath $tunnelErrorLog -Raw -ErrorAction SilentlyContinue)
            $match = [regex]::Match($content, 'https://[a-zA-Z0-9.-]+\.lhr\.life')
            if ($match.Success) {
                $publicUrl = $match.Value
                break
            }
            if ($tunnel.HasExited) {
                break
            }
        }

        if ($publicUrl) {
            Update-GitHubWebhook $publicUrl
            Add-Content -LiteralPath $supervisorLog -Value "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] GitHub webhook updated: $publicUrl/github-webhook/"
        } else {
            Add-Content -LiteralPath $supervisorLog -Value "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Tunnel URL was not assigned; retrying."
        }

        while (-not $tunnel.HasExited) {
            if (-not (Test-JenkinsReady)) {
                Add-Content -LiteralPath $supervisorLog -Value "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Jenkins is unavailable; starting it again."
                Start-JenkinsIfNeeded
            }
            Start-Sleep -Seconds $RetryDelaySeconds
        }
    } catch {
        Add-Content -LiteralPath $supervisorLog -Value "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $($_.Exception.Message)"
    }

    Start-Sleep -Seconds $RetryDelaySeconds
    Start-JenkinsIfNeeded
}
