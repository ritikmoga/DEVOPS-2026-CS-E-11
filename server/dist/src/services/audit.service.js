import { prisma } from "../prisma.js";
export async function audit(req, action, resourceType, resourceId, oldValue, newValue, metadata) {
  await prisma.auditLog.create({
    data: {
      actorId: req.user?.id,
      action,
      resourceType,
      resourceId,
      oldValue: oldValue,
      newValue: newValue,
      metadata: metadata,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    },
  });
}
//# sourceMappingURL=audit.service.js.map
