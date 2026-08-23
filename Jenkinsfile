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

    parameters {
        string(
            name: 'REPORT_EMAIL',
            defaultValue: 'ritikmoga13@gmail.com',
            trim: true,
            description: 'Gmail address that receives the Jenkins frontend report'
        )
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
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
                junit testResults: 'reports/frontend-junit.xml', allowEmptyResults: true
                archiveArtifacts artifacts: 'reports/**', allowEmptyArchive: true, fingerprint: true

                def result = currentBuild.currentResult ?: 'FAILURE'
                def githubStatus = result == 'SUCCESS' ? 'SUCCESS' : (result == 'UNSTABLE' ? 'ERROR' : 'FAILURE')
                def report = fileExists('reports/frontend-test-report.md')
                    ? readFile('reports/frontend-test-report.md')
                    : 'Frontend report was not generated. Check the Jenkins console log.'

                // GitHub commit status: visible on the commit and in pull requests.
                try {
                    githubNotify(
                        context: 'Jenkins / frontend',
                        description: "Frontend verification: ${result}",
                        status: githubStatus,
                        targetUrl: env.BUILD_URL
                    )
                } catch (err) {
                    echo "GitHub status was not published: ${err}"
                }

                // Optional detailed GitHub Check. The commit status above still works
                // when the Checks API plugin is not installed.
                try {
                    publishChecks(
                        name: 'Frontend CI',
                        title: 'Jenkins frontend verification',
                        summary: report.take(65000),
                        text: report,
                        detailsURL: env.BUILD_URL
                    )
                } catch (err) {
                    echo "Detailed GitHub Check was not published: ${err}"
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
