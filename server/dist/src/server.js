import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./prisma.js";
const server = app.listen(env.PORT, () =>
  console.log(`Event platform API listening on http://localhost:${env.PORT}`),
);
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down`);
  const forceExit = setTimeout(() => process.exit(1), 10_000);
  forceExit.unref();
  server.close(async (error) => {
    await prisma.$disconnect();
    clearTimeout(forceExit);
    process.exit(error ? 1 : 0);
  });
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection", reason);
  void shutdown("unhandledRejection");
});
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception", error);
  void shutdown("uncaughtException");
});
//# sourceMappingURL=server.js.map
