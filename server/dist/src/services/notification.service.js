import { prisma } from "../prisma.js";
export async function notifyUsers(userIds, type, title, message) {
    if (!userIds.length)
        return;
    await prisma.notification.create({
        data: { type, title, message, recipients: { create: userIds.map((userId) => ({ userId })) } },
    });
}
export async function listNotifications(userId, page, limit) {
    const where = { userId };
    const [total, rows] = await prisma.$transaction([
        prisma.notificationRecipient.count({ where }),
        prisma.notificationRecipient.findMany({
            where,
            include: { notification: true },
            orderBy: { notification: { createdAt: "desc" } },
            skip: (page - 1) * limit,
            take: limit,
        }),
    ]);
    return { total, rows };
}
//# sourceMappingURL=notification.service.js.map