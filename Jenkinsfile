def runInDirectory(String directory, String command) {
    dir(directory) {
        if (isUnix()) {
            sh command
        } else {
            bat command
        }
    }
}

pipeline {
    agent any

    options {
        timestamps()
        skipDefaultCheckout(true)
    }

    triggers {
        // Start immediately when the GitHub webhook reaches Jenkins.
        // Keep polling as a fallback when Jenkins/GitHub cannot deliver the webhook.
        githubPush()
        pollSCM('H/1 * * * *')
    }

    parameters {
        string(
            name: 'REPORT_EMAIL',
            defaultValue: 'sumit.kumar@skit.ac.in, ritikmoga13@gmail.com',
            trim: true,
            description: 'Comma-separated recipients for the Jenkins frontend report'
        )
    }

    stages {
        stage('Prepare reports') {
            steps {
                // Remove reports from an older workspace before checkout/test execution.
                // This prevents a failed checkout from being shown with stale test results.
                dir('reports') {
                    deleteDir()
                }
                script {
                    if (isUnix()) {
                        sh 'rm -f .jenkins-checkout-complete'
                    } else {
                        bat 'if exist .jenkins-checkout-complete del /q .jenkins-checkout-complete'
                    }
                }
            }
        }

        stage('Checkout') {
            steps {
                retry(3) {
                    checkout scm
                }
                script {
                    def checkedOutCommit = isUnix()
                        ? sh(returnStdout: true, script: 'git rev-parse HEAD').trim()
                        : bat(returnStdout: true, script: '@git rev-parse HEAD').trim()
                    env.GIT_COMMIT = checkedOutCommit
                    writeFile file: '.jenkins-checkout-complete', text: checkedOutCommit
                }
            }
        }

        stage('Detect report publication commit') {
            steps {
                script {
                    def subject = isUnix()
                        ? sh(returnStdout: true, script: 'git log -1 --pretty=%s').trim()
                        : bat(returnStdout: true, script: '@git log -1 --pretty=%%s').trim()
                    env.REPORT_ONLY_COMMIT = subject.startsWith('[skip ci] ci: publish frontend test report') ? 'true' : 'false'
                    if (env.REPORT_ONLY_COMMIT == 'true') {
                        echo 'Report publication commit detected; skipping test execution to prevent a CI loop.'
                    }
                }
            }
        }

        stage('Install frontend dependencies') {
            when {
                expression { env.REPORT_ONLY_COMMIT != 'true' }
            }
            steps {
                script {
                    runInDirectory('frontend-demo/public-client', 'npm install --no-audit --no-fund --no-package-lock')
                    runInDirectory('frontend-demo/admin-client', 'npm install --no-audit --no-fund --no-package-lock')
                }
            }
        }

        stage('Verify frontends') {
            when {
                expression { env.REPORT_ONLY_COMMIT != 'true' }
            }
            steps {
                script {
                    catchError(buildResult: 'FAILURE', stageResult: 'FAILURE') {
                        if (isUnix()) {
                            sh 'node ci/verify-frontends.mjs'
                        } else {
                            bat 'node ci/verify-frontends.mjs'
                        }
                    }
                }
            }
        }

        stage('Publish report to GitHub') {
            when {
                expression { env.REPORT_ONLY_COMMIT != 'true' }
            }
            steps {
                script {
                    if (fileExists('reports/frontend-test-report.md')) {
                        catchError(buildResult: 'UNSTABLE', stageResult: 'UNSTABLE') {
                            withCredentials([
                                usernamePassword(
                                    credentialsId: 'github-auth',
                                    usernameVariable: 'GITHUB_USERNAME',
                                    passwordVariable: 'GITHUB_TOKEN'
                                )
                            ]) {
                                def reportBranch = 'main'
                                if (isUnix()) {
                                    sh """
                                        set +x
                                        git config user.name 'Jenkins'
                                        git config user.email 'jenkins@users.noreply.github.com'
                                        git add reports/frontend-test-report.md reports/frontend-junit.xml
                                        if git diff --cached --quiet; then exit 0; fi
                                        git commit -m '[skip ci] ci: publish frontend test report'
                                        git push https://\$GITHUB_USERNAME:\$GITHUB_TOKEN@github.com/ritikmoga/DEVOPS-2026-CS-E-11.git HEAD:${reportBranch}
                                    """
                                } else {
                                    bat """
                                        @echo off
                                        git config user.name Jenkins
                                        git config user.email jenkins@users.noreply.github.com
                                        git add reports/frontend-test-report.md reports/frontend-junit.xml
                                        git diff --cached --quiet
                                        if %ERRORLEVEL% EQU 0 exit /b 0
                                        git commit -m "[skip ci] ci: publish frontend test report"
                                        git push https://%GITHUB_USERNAME%:%GITHUB_TOKEN%@github.com/ritikmoga/DEVOPS-2026-CS-E-11.git HEAD:${reportBranch}
                                    """
                                }
                            }
                        }
                    } else {
                        echo 'No frontend Markdown report was generated; nothing to publish.'
                    }
                }
            }
        }
    }

    post {
        always {
            script {
                def result = currentBuild.currentResult ?: 'FAILURE'
                def reportOnlyCommit = env.REPORT_ONLY_COMMIT == 'true'
                if (!reportOnlyCommit && fileExists('reports/frontend-junit.xml')) {
                    junit testResults: 'reports/frontend-junit.xml', allowEmptyResults: false
                } else {
                    echo reportOnlyCommit
                        ? 'Report publication commit detected; skipping duplicate test-result publication.'
                        : 'No current-build JUnit report found; skipping test-result publication.'
                }

                archiveArtifacts artifacts: 'reports/**', allowEmptyArchive: true, fingerprint: true

                def report = fileExists('reports/frontend-test-report.md')
                    ? readFile('reports/frontend-test-report.md')
                    : 'Frontend report was not generated. Check the Jenkins console log.'

                def checkoutComplete = fileExists('.jenkins-checkout-complete')
                def commit = checkoutComplete ? readFile('.jenkins-checkout-complete').trim() : null

                // Publish a GitHub commit status only after this build checked out a commit.
                // This prevents a failed fetch from updating a stale workspace commit.
                if (!reportOnlyCommit && checkoutComplete && commit) {
                    try {
                    def githubState = result == 'SUCCESS' ? 'success' : 'failure'
                    withCredentials([
                        usernamePassword(
                            credentialsId: 'github-auth',
                            usernameVariable: 'GITHUB_USERNAME',
                            passwordVariable: 'GITHUB_TOKEN'
                        )
                    ]) {
                        def statusCode = powershell(returnStatus: true, script: """
                            \$headers = @{
                                Authorization = \"Bearer \$env:GITHUB_TOKEN\"
                                Accept = 'application/vnd.github+json'
                                'X-GitHub-Api-Version' = '2022-11-28'
                            }
                            \$payload = @{
                                state = '${githubState}'
                                target_url = '${env.BUILD_URL}'
                                description = 'Frontend verification: ${result}'
                                context = 'jenkins/frontend'
                            } | ConvertTo-Json
                            try {
                                Invoke-RestMethod -Uri 'https://api.github.com/repos/ritikmoga/DEVOPS-2026-CS-E-11/statuses/${commit}' -Method Post -Headers \$headers -Body \$payload -ContentType 'application/json'
                                Write-Host 'GitHub commit status published.'
                                exit 0
                            } catch {
                                Write-Error \$_.Exception.Message
                                exit 1
                            }
                        """)
                        if (statusCode != 0) {
                            echo 'GitHub commit status could not be published.'
                        }
                    }
                    } catch (err) {
                        echo "GitHub status was not published: ${err}"
                    }
                } else if (reportOnlyCommit) {
                    echo 'Skipping GitHub status because this is a report publication commit.'
                } else {
                    echo 'Skipping GitHub status because checkout did not complete.'
                }

                def recipient = params.REPORT_EMAIL?.trim()
                if (!reportOnlyCommit && recipient) {
                    try {
                        def emailBody = """Frontend test report

${report}

Jenkins build: ${env.BUILD_URL}

The Markdown and JUnit report files are attached to this email as well.
"""
                        emailext(
                            to: recipient,
                            subject: "${env.JOB_NAME} #${env.BUILD_NUMBER}: frontend ${result}",
                            body: emailBody,
                            mimeType: 'text/plain',
                            attachmentsPattern: 'reports/frontend-test-report.md,reports/frontend-junit.xml'
                        )
                    } catch (err) {
                        echo "Email report was not sent: ${err}"
                    }
                } else if (reportOnlyCommit) {
                    echo 'Skipping duplicate email for a report publication commit.'
                } else {
                    echo 'REPORT_EMAIL is empty; skipping email notification.'
                }
            }
        }
    }
}
