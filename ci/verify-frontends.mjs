import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const bundledWindowsNpmCli = resolve(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
const npmCli =
  process.env.npm_execpath ||
  (process.platform === "win32" && existsSync(bundledWindowsNpmCli) ? bundledWindowsNpmCli : null);
const checks = [
  {
    name: "Public frontend JavaScript syntax check",
    directory: "frontend/public-client",
    command: "typecheck",
  },
  {
    name: "Public frontend production build",
    directory: "frontend/public-client",
    command: "build",
  },
  {
    name: "Admin frontend JavaScript syntax check",
    directory: "frontend/admin-client",
    command: "typecheck",
  },
  { name: "Admin frontend production build", directory: "frontend/admin-client", command: "build" },
];

const results = checks.map((check) => {
  const startedAt = Date.now();
  const result = spawnSync(
    npmCli ? process.execPath : npmCommand,
    npmCli ? [npmCli, "run", check.command] : ["run", check.command],
    {
      cwd: resolve(root, check.directory),
      encoding: "utf8",
      // Windows command shims such as npm.cmd require cmd.exe when the npm
      // JavaScript CLI is not available beside the Node executable.
      shell: process.platform === "win32" && !npmCli,
    },
  );
  const output = [result.stdout, result.stderr, result.error?.message]
    .filter(Boolean)
    .join("\n")
    .trim();

  return {
    ...check,
    passed: result.status === 0 && !result.error,
    durationMs: Date.now() - startedAt,
    output,
  };
});

const escapeXml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const cdata = (value) => `<![CDATA[${value.replaceAll("]]>", "]]]]><![CDATA[>")}]]>`;
const failures = results.filter((result) => !result.passed).length;

// The generated report is committed back to `main` by the Jenkins job, so it has
// to be deterministic. Per-run durations and the content-hashed asset names that
// Vite prints change on every build even when nothing changed, which meant every
// poll produced a diff, which produced a commit, which triggered another build.
// Timings stay in the console log and the archived build instead.

// The Jenkins "Prepare reports" stage deletes this directory before the checkout,
// so it has to be recreated here.
mkdirSync(resolve(root, "reports"), { recursive: true });

const junit = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  `<testsuite name="Frontend CI" tests="${results.length}" failures="${failures}">`,
  ...results.map((result) => {
    const failure = result.passed
      ? ""
      : `<failure message="${escapeXml(`${result.name} failed`)}">${cdata(result.output)}</failure>`;
    return `  <testcase classname="${escapeXml(result.directory)}" name="${escapeXml(result.name)}">${failure}</testcase>`;
  }),
  "</testsuite>",
  "",
].join("\n");

const markdown = [
  "# Frontend CI report",
  "",
  `- Commit: ${process.env.GIT_COMMIT || process.env.GITHUB_SHA || "local"}`,
  `- Result: **${failures === 0 ? "PASSED" : "FAILED"}**`,
  "",
  "| Check | Result |",
  "| --- | --- |",
  ...results.map((result) => `| ${result.name} | ${result.passed ? "✅ Passed" : "❌ Failed"} |`),
  "",
  ...(failures > 0
    ? [
        "## Failure output",
        "",
        ...results.flatMap((result) =>
          result.passed
            ? []
            : [`### ${result.name}`, "", "```text", result.output || "(no output)", "```", ""],
        ),
      ]
    : []),
  "",
].join("\n");

writeFileSync(resolve(root, "reports/frontend-junit.xml"), junit);
writeFileSync(resolve(root, "reports/frontend-test-report.md"), markdown);

console.log(markdown);
if (failures > 0) {
  process.exitCode = 1;
}
