import "dotenv/config";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

if (!process.env.DATABASE_URL) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL is required in production.");
  }

  // Schema validation does not connect to MongoDB, but Prisma still requires
  // a datasource URL while parsing the schema.
  process.env.DATABASE_URL =
    "mongodb://eventhub:eventhub@localhost:27017/event_management?replicaSet=rs0";
}

const prismaCli = resolve("node_modules/prisma/build/index.js");

if (!existsSync(prismaCli)) {
  throw new Error("Prisma CLI is not installed. Run npm ci in the server directory.");
}

const result = spawnSync(
  process.execPath,
  [prismaCli, "validate", "--schema", "prisma/schema.prisma"],
  {
    env: process.env,
    stdio: "inherit",
  },
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
