import { PrismaClient } from "@prisma/client";

const RoleName = Object.freeze({
  STUDENT: "STUDENT",
  USER: "USER",
  CHECKIN_STAFF: "CHECKIN_STAFF",
  EVENT_COORDINATOR: "EVENT_COORDINATOR",
  FACULTY: "FACULTY",
  ORGANIZER: "ORGANIZER",
  ADMIN: "ADMIN",
  SUPER_ADMIN: "SUPER_ADMIN",
});
import bcrypt from "bcryptjs";
import "dotenv/config";

if (!process.env.DATABASE_URL) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL is required in production.");
  }

  process.env.DATABASE_URL =
    "postgresql://eventhub:eventhub@localhost:5432/event_management?schema=public";
}

const prisma = new PrismaClient();
const permissionCodes = [
  "EVENT_CREATE",
  "EVENT_UPDATE",
  "EVENT_DELETE",
  "EVENT_PUBLISH",
  "REGISTRATION_VIEW",
  "REGISTRATION_APPROVE",
  "ATTENDANCE_SCAN",
  "ATTENDANCE_EDIT",
  "CERTIFICATE_GENERATE",
  "USER_MANAGE",
  "ADMIN_MANAGE",
  "REPORT_EXPORT",
  "AUDIT_LOG_VIEW",
  "PROOF_REVIEW",
];
const rolePermissions = {
  STUDENT: [],
  USER: [],
  CHECKIN_STAFF: ["ATTENDANCE_SCAN", "REGISTRATION_VIEW"],
  EVENT_COORDINATOR: [
    "EVENT_CREATE",
    "EVENT_UPDATE",
    "EVENT_PUBLISH",
    "REGISTRATION_VIEW",
    "REGISTRATION_APPROVE",
    "ATTENDANCE_SCAN",
    "ATTENDANCE_EDIT",
    "PROOF_REVIEW",
  ],
  FACULTY: ["PROOF_REVIEW", "REGISTRATION_VIEW"],
  ORGANIZER: [
    "EVENT_CREATE",
    "EVENT_UPDATE",
    "REGISTRATION_VIEW",
    "ATTENDANCE_SCAN",
    "PROOF_REVIEW",
  ],
  ADMIN: permissionCodes,
  SUPER_ADMIN: permissionCodes,
};
async function main() {
  const permissions = new Map();
  for (const code of permissionCodes)
    permissions.set(
      code,
      await prisma.permission.upsert({ where: { code }, update: {}, create: { code } }),
    );
  for (const name of Object.values(RoleName)) {
    const role = await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
    for (const code of rolePermissions[name]) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: permissions.get(code).id },
        },
        update: {},
        create: { roleId: role.id, permissionId: permissions.get(code).id },
      });
    }
  }
  const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const adminName = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || "Platform Administrator";
  if (!adminEmail && !adminPassword) {
    console.log("Seeded roles and permissions. No bootstrap administrator was requested.");
    return;
  }
  if (!adminEmail || !adminPassword) {
    throw new Error("BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD must be set together");
  }
  if (adminPassword.length < 12) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD must contain at least 12 characters");
  }
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      fullName: adminName,
      passwordHash,
      emailVerifiedAt: new Date(),
      isActive: true,
      deletedAt: null,
    },
    create: {
      email: adminEmail,
      fullName: adminName,
      passwordHash,
      emailVerifiedAt: new Date(),
    },
  });
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "SUPER_ADMIN" } });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: adminRole.id },
  });
  console.log(`Seeded roles, permissions, and bootstrap administrator ${adminEmail}`);
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
