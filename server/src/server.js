import app from "./app.js";
import { connectDatabase } from "./config/database.js";
import { env } from "./config/env.js";

const server = app.listen(env.PORT, () => {
  console.log(`EventFlow API listening on port ${env.PORT}`);
});

connectDatabase().catch((error) => {
  console.error("MongoDB is unavailable:", error.message);
});

function shutdown(signal) {
  console.log(`${signal} received; shutting down.`);
  server.close(() => process.exit(0));
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
