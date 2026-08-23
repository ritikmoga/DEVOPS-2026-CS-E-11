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
        pollSCM('H/1 * * * *')
    }

    parameters {
        string(
            name: 'REPORT_EMAIL',
            defaultValue: 'ritikmoga13@gmail.com',
            trim: true,
            description: 'Gmail address that receives the Jenkins frontend report'
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

        stage('Install frontend dependencies') {
            steps {
                script {
                    runInDirectory('public-client', 'npm install --no-audit --no-fund --no-package-lock')
                    runInDirectory('admin-client', 'npm install --no-audit --no-fund --no-package-lock')
                }
            }
        }

        stage('Verify frontends') {
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
    }

    post {
        always {
            script {
                def result = currentBuild.currentResult ?: 'FAILURE'
                if (fileExists('reports/frontend-junit.xml')) {
                    junit testResults: 'reports/frontend-junit.xml', allowEmptyResults: false
                } else {
                    echo 'No current-build JUnit report found; skipping test-result publication.'
                }

                archiveArtifacts artifacts: 'reports/**', allowEmptyArchive: true, fingerprint: true

                def report = fileExists('reports/frontend-test-report.md')
                    ? readFile('reports/frontend-test-report.md')
                    : 'Frontend report was not generated. Check the Jenkins console log.'

                def checkoutComplete = fileExists('.jenkins-checkout-complete')
                def commit = checkoutComplete ? readFile('.jenkins-checkout-complete').trim() : null

                // Publish a GitHub commit status only after this build checked out a commit.
                // This prevents a failed fetch from updating a stale workspace commit.
                if (checkoutComplete && commit) {
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
                                Invoke-RestMethod -Uri 'https://api.github.com/repos/ritikmoga/EVENT_MANAGEMENT_SYSTEM-MERN-STACK/statuses/${commit}' -Method Post -Headers \$headers -Body \$payload -ContentType 'application/json'
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
                } else {
                    echo 'Skipping GitHub status because checkout did not complete.'
                }

                def recipient = params.REPORT_EMAIL?.trim()
                if (recipient) {
                    try {
                        emailext(
                            to: recipient,
                            subject: "${env.JOB_NAME} #${env.BUILD_NUMBER}: frontend ${result}",
                            body: "${report}\n\nJenkins build: ${env.BUILD_URL}",
                            attachmentsPattern: 'reports/frontend-test-report.md'
                        )
                    } catch (err) {
                        echo "Email report was not sent: ${err}"
                    }
                } else {
                    echo 'REPORT_EMAIL is empty; skipping email notification.'
                }
            }
        }
    }
}
