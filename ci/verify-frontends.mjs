import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const npmCli = process.env.npm_execpath;
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
const totalSeconds = results.reduce((sum, result) => sum + result.durationMs, 0) / 1000;

mkdirSync(resolve(root, "reports"), { recursive: true });

const junit = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  `<testsuite name="Frontend CI" tests="${results.length}" failures="${failures}" time="${totalSeconds.toFixed(3)}">`,
  ...results.map((result) => {
    const seconds = (result.durationMs / 1000).toFixed(3);
    const failure = result.passed
      ? ""
      : `<failure message="${escapeXml(`${result.name} failed`)}">${cdata(result.output)}</failure>`;
    return `  <testcase classname="${escapeXml(result.directory)}" name="${escapeXml(result.name)}" time="${seconds}">${failure}<system-out>${cdata(result.output)}</system-out></testcase>`;
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
  "| Check | Result | Duration |",
  "| --- | --- | ---: |",
  ...results.map(
    (result) =>
      `| ${result.name} | ${result.passed ? "✅ Passed" : "❌ Failed"} | ${(result.durationMs / 1000).toFixed(2)}s |`,
  ),
  "",
  "## Output",
  "",
  ...results.flatMap((result) => [
    `### ${result.name}`,
    "",
    "```text",
    result.output || "(no output)",
    "```",
    "",
  ]),
].join("\n");

writeFileSync(resolve(root, "reports/frontend-junit.xml"), junit);
writeFileSync(resolve(root, "reports/frontend-test-report.md"), markdown);

console.log(markdown);
if (failures > 0) {
  process.exitCode = 1;
}
