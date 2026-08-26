import { existsSync, readdirSync, readFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const serverDirectory = resolve(root, "server");
const distDirectory = resolve(serverDirectory, "dist");

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = resolve(directory, entry.name);
    return entry.isDirectory() ? walk(entryPath) : [entryPath];
  });
}

function sleep(milliseconds) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));
}

function findFreePort() {
  return new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : null;
      probe.close((error) => {
        if (error) reject(error);
        else if (port) resolvePort(port);
        else reject(new Error("Could not allocate a free health-check port"));
      });
    });
  });
}

function runNodeCheck(filePath) {
  const result = spawnSync(process.execPath, ["--check", filePath], {
    encoding: "utf8",
  });

  return {
    passed: result.status === 0 && !result.error,
    output: [result.stdout, result.stderr, result.error?.message].filter(Boolean).join("\n").trim(),
  };
}

async function waitForHealth(child, port, logs) {
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Backend exited before health check completed.\n${logs.join("\n")}`);
    }

    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      const payload = await response.json();

      if (response.ok && payload.success === true && payload.data?.status === "ok") {
        return;
      }
    } catch {
      // The server can need a few attempts while Node loads its dependencies.
    }

    await sleep(150);
  }

  throw new Error(`Backend health endpoint did not respond within 10 seconds.\n${logs.join("\n")}`);
}

async function smokeTestHealthEndpoint() {
  const port = await findFreePort();
  const logs = [];
  const child = spawn(process.execPath, ["dist/src/server.js"], {
    cwd: serverDirectory,
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(port),
      DATABASE_URL: "postgresql://eventhub:eventhub@127.0.0.1:5432/ci_health_check?schema=public",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => logs.push(String(chunk).trim()));
  child.stderr.on("data", (chunk) => logs.push(String(chunk).trim()));

  try {
    await waitForHealth(child, port, logs);
  } finally {
    if (child.exitCode === null) child.kill();
  }
}

async function main() {
  const packagePath = resolve(serverDirectory, "package.json");
  const schemaPath = resolve(serverDirectory, "prisma/schema.prisma");
  const entrypoint = resolve(distDirectory, "src/server.js");

  for (const requiredPath of [packagePath, schemaPath, entrypoint]) {
    if (!existsSync(requiredPath)) {
      throw new Error(`Required backend file is missing: ${relative(root, requiredPath)}`);
    }
  }

  const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
  if (packageJson.scripts?.start !== "node dist/src/server.js") {
    throw new Error("server/package.json must start the committed backend entrypoint");
  }

  const javascriptFiles = walk(distDirectory).filter((filePath) => filePath.endsWith(".js"));
  if (javascriptFiles.length === 0) {
    throw new Error("No JavaScript files were found under server/dist");
  }

  for (const filePath of javascriptFiles) {
    const result = runNodeCheck(filePath);
    if (!result.passed) {
      throw new Error(`Syntax check failed for ${relative(root, filePath)}\n${result.output}`);
    }
  }

  await smokeTestHealthEndpoint();
  console.log(
    `Backend verification passed: ${javascriptFiles.length} runtime files checked and /health responded successfully.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
