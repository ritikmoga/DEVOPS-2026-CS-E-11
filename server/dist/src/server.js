import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./prisma.js";
const server = app.listen(env.PORT, () =>
  console.log(`Event platform API listening on http://localhost:${env.PORT}`),
);
async function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
//# sourceMappingURL=server.js.map
