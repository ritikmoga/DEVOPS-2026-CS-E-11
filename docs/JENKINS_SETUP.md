# Jenkins, GitHub and Gmail setup

The root `Jenkinsfile` runs these checks for both frontends:

- `frontend-demo/public-client`: typecheck and production build
- `frontend-demo/admin-client`: typecheck and production build

It creates a JUnit XML report and a Markdown report. Jenkins archives the reports and publishes a detailed GitHub Check when the Checks API plugin is installed.

## Jenkins job

1. Install these Jenkins plugins: Pipeline, GitHub Branch Source, GitHub, JUnit, and Email Extension.
2. Create a Multibranch Pipeline for `https://github.com/ritikmoga/DEVOPS-2026-CS-E-11.git`.
3. Enable discovery of the `main`, `RITIK_MERNSTACK`, `ROHAN_MERNSTACK`, and `Rohit-MERNSTACK` branches.
4. Create a Jenkins username/password credential with ID `github-auth`, using a GitHub username and token with commit-status permission. Configure the GitHub repository webhook to send push events to `https://YOUR_JENKINS_URL/github-webhook/` with JSON delivery and enable the job's GitHub hook trigger.
5. Use an agent with Node.js/npm installed. Node.js 20 or newer is recommended.

The pipeline parameter `REPORT_EMAIL` defaults to `ritikmoga13@gmail.com` and can be changed when starting a build.

The Jenkinsfile starts builds immediately through `githubPush()` when a GitHub push webhook is delivered, and polls the GitHub `main` branch every minute (`H/1 * * * *`) as a fallback. Instant GitHub webhooks require a public Jenkins URL; a `localhost` or LAN-only URL cannot receive requests from GitHub. In a Multibranch Pipeline, ensure GitHub Branch Source webhook/scanning is enabled for the repository.

## Gmail notifications

Configure SMTP globally in Jenkins; do not commit an SMTP password:

- SMTP host: `smtp.gmail.com`
- Port: `587`
- TLS/STARTTLS: enabled
- Username: the Gmail account used to send reports
- Password: a Google App Password for that account

Configure the Extended E-mail Notification section with the same SMTP settings. The pipeline uses the Email Extension plugin to send the Markdown report as an attachment after every build, including failed builds.
