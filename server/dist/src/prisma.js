import { env } from "./config/env.js";
import { createPrismaClient } from "./prisma-client.js";

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ??
  createPrismaClient({
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
