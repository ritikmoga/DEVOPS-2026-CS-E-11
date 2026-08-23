$ErrorActionPreference = 'SilentlyContinue'

$jenkinsUrl = 'http://LAPTOP-08HFC5NN:8080/'
$javaPath = 'C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot\bin\java.exe'
$warPath = 'C:\Users\RITIK\Downloads\jenkins.war'
$jenkinsHome = 'C:\Users\RITIK\.jenkins'
$stdoutPath = 'C:\tmp\jenkins-shortcut.stdout.log'
$stderrPath = 'C:\tmp\jenkins-shortcut.stderr.log'

function Test-JenkinsRunning {
    return Test-NetConnection -ComputerName '127.0.0.1' -Port 8080 -InformationLevel Quiet -WarningAction SilentlyContinue
}

if (-not (Test-JenkinsRunning)) {
    Start-Process `
        -FilePath $javaPath `
        -ArgumentList @('-Xms256m', '-Xmx512m', "-DJENKINS_HOME=$jenkinsHome", '-jar', $warPath, '--httpPort=8080') `
        -WorkingDirectory (Split-Path -Parent $warPath) `
        -WindowStyle Hidden `
        -RedirectStandardOutput $stdoutPath `
        -RedirectStandardError $stderrPath | Out-Null
}

for ($attempt = 0; $attempt -lt 30; $attempt++) {
    if (Test-JenkinsRunning) {
        Start-Process $jenkinsUrl
        exit 0
    }
    Start-Sleep -Seconds 2
}

Start-Process $jenkinsUrl
