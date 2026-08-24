import { PrismaClient, RoleName } from "@prisma/client";
import bcrypt from "bcryptjs";
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
        permissions.set(code, await prisma.permission.upsert({ where: { code }, update: {}, create: { code } }));
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
    const passwordHash = await bcrypt.hash("ChangeMe123!", 12);
    const adminPasswordHash = await bcrypt.hash("Ritik1975", 12);
    const accounts = [
        { email: "superadmin@example.com", fullName: "Platform Super Admin", role: "SUPER_ADMIN" },
        {
            email: "ritikmoga13@gmail.com",
            fullName: "Ritik Moga",
            role: "ADMIN",
            department: "Administration",
        },
        {
            email: "faculty@example.com",
            fullName: "Faculty Reviewer",
            role: "FACULTY",
            department: "Computer Science",
        },
        {
            email: "student@example.com",
            fullName: "Demo Student",
            role: "STUDENT",
            department: "Computer Science",
        },
    ];
    for (const account of accounts) {
        const user = await prisma.user.upsert({
            where: { email: account.email },
            update: {
                fullName: account.fullName,
                department: account.department,
                passwordHash: account.email === "ritikmoga13@gmail.com" ? adminPasswordHash : passwordHash,
                emailVerifiedAt: new Date(),
                isActive: true,
                deletedAt: null,
            },
            create: {
                email: account.email,
                fullName: account.fullName,
                department: account.department,
                passwordHash: account.email === "ritikmoga13@gmail.com" ? adminPasswordHash : passwordHash,
                emailVerifiedAt: new Date(),
                deletedAt: null,
            },
        });
        const role = await prisma.role.findUniqueOrThrow({ where: { name: account.role } });
        await prisma.userRole.deleteMany({ where: { userId: user.id } });
        await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
    }
    const legacyAdmin = await prisma.user.findUnique({ where: { email: "admin@example.com" } });
    const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "ADMIN" } });
    if (legacyAdmin)
        await prisma.userRole.deleteMany({ where: { userId: legacyAdmin.id, roleId: adminRole.id } });
    const category = await prisma.eventCategory.upsert({
        where: { name: "Technology" },
        update: {},
        create: { name: "Technology", description: "Technology and innovation events" },
    });
    const organizer = await prisma.organizer
        .create({ data: { name: "Innovation Cell", contactEmail: "innovation@example.com" } })
        .catch(() => prisma.organizer.findFirstOrThrow({ where: { name: "Innovation Cell" } }));
    const admin = await prisma.user.findUniqueOrThrow({
        where: { email: "ritikmoga13@gmail.com" },
    });
    const event = await prisma.event.upsert({
        where: { slug: "campus-innovation-summit" },
        update: { deletedAt: null },
        create: {
            title: "Campus Innovation Summit 2026",
            slug: "campus-innovation-summit",
            shortDescription: "A practical summit for builders, researchers, and student founders.",
            description: "Join a full-day summit with talks, workshops, and a project showcase.",
            categoryId: category.id,
            organizerId: organizer.id,
            mode: "OFFLINE",
            venueName: "Main Auditorium",
            venueAddress: "Innovation Block",
            city: "Bengaluru",
            state: "Karnataka",
            capacity: 250,
            startAt: new Date("2026-10-18T04:30:00.000Z"),
            endAt: new Date("2026-10-18T12:30:00.000Z"),
            registrationStartAt: new Date("2026-08-01T00:00:00.000Z"),
            registrationEndAt: new Date("2026-10-17T18:30:00.000Z"),
            status: "PUBLISHED",
            publishedAt: new Date(),
            createdById: admin.id,
            tags: ["innovation", "technology"],
            minimumAttendancePercentage: 75,
            certificateEnabled: true,
            deletedAt: null,
        },
    });
    console.log(`Seeded event ${event.slug}`);
}
main().finally(() => prisma.$disconnect());
//# sourceMappingURL=seed.js.map