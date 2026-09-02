// import { PrismaClient } from "@prisma/client";
// import { env } from "./config/env.js";
// export const prisma = new PrismaClient({
//   log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
// });
// //# sourceMappingURL=prisma.js.map




'























import { PrismaClient } from "@prisma/client";
import { env } from "./config/env.js";

/**
 * Prisma Client
 *
 * - Logs warnings and errors in development.
 * - Logs only errors in production.
 * - Reuses the Prisma instance during development
 *   to prevent multiple database connections during hot reloads.
 */

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
