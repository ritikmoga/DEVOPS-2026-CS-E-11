# Progress report generation

`generate_report.py` creates a PDF contribution report from the local Git history.

## Local use

From the repository root, install the report dependencies once:

```powershell
python -m pip install --requirement requirements-report.txt
```

Create a report for one of these periods:

```powershell
python generate_report.py weekly
python generate_report.py monthly
python generate_report.py final
```

The script saves a dated PDF in the repository root. It does not commit, push, or upload anything.

## Optional GitHub Actions workflow

`.github/workflows/auto_weekly_report.yml` runs every Monday at 03:00 IST and can also be started manually. It checks out the full Git history, generates the PDF, and stores it as a workflow artifact only. It has read-only repository permissions and does not commit or push generated files.

The workflow remains local until someone explicitly commits and pushes it to GitHub.
