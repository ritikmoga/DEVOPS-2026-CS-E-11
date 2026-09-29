import "dotenv/config";
import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL is required in production.");
  }

  process.env.DATABASE_URL =
    "mongodb://eventhub:eventhub@localhost:27017/event_management?replicaSet=rs0";
}

const prisma = new PrismaClient();

try {
  const [roles, permissions, users, events, registrations] = await prisma.$transaction([
    prisma.role.count(),
    prisma.permission.count(),
    prisma.user.count(),
    prisma.event.count(),
    prisma.registration.count(),
  ]);

  if (roles === 0 || permissions === 0) {
    throw new Error("RBAC seed is missing. Run npm run db:seed.");
  }

  console.log(JSON.stringify({ roles, permissions, users, events, registrations }, null, 2));
  console.log("MongoDB database verification passed.");
} finally {
  await prisma.$disconnect();
}
