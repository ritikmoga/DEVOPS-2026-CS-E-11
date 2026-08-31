import { prisma } from "../prisma.js";
import { hashToken } from "../utils/crypto.js";
import { AppError } from "../utils/http.js";
function distanceMeters(lat1, lon1, lat2, lon2) {
  const earth = 6371000;
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1),
    dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function validateLocation(event, location) {
  if (event.latitude == null || event.longitude == null || !event.allowedRadiusMeters) return;
  if (location?.latitude == null || location.longitude == null)
    throw new AppError("Location is required for this event", 422, "LOCATION_REQUIRED");
  const distance = distanceMeters(
    Number(event.latitude),
    Number(event.longitude),
    location.latitude,
    location.longitude,
  );
  if (distance > event.allowedRadiusMeters)
    throw new AppError(
      "You are outside the permitted attendance area",
      403,
      "OUTSIDE_ATTENDANCE_RADIUS",
      [{ distanceMeters: Math.round(distance), allowedRadiusMeters: event.allowedRadiusMeters }],
    );
}
async function findTicket(token, eventId) {
  const ticket = await prisma.ticket.findFirst({
    where: { tokenHash: hashToken(token) },
    include: {
      registration: {
        include: {
          event: true,
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              department: true,
              enrollmentNumber: true,
            },
          },
        },
      },
    },
  });
  if (
    !ticket ||
    ticket.status !== "ACTIVE" ||
    ticket.revokedAt ||
    (ticket.expiresAt && ticket.expiresAt < new Date())
  )
    throw new AppError("Ticket is invalid, expired, or revoked", 400, "INVALID_TICKET");
  if (eventId && ticket.registration.eventId !== eventId)
    throw new AppError("This ticket belongs to a different event", 409, "WRONG_EVENT_TICKET");
  if (!["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"].includes(ticket.registration.status))
    throw new AppError(
      "Registration is not eligible for attendance",
      409,
      "REGISTRATION_NOT_ELIGIBLE",
    );
  return ticket;
}
export async function validateTicket(token, eventId) {
  const ticket = await findTicket(token, eventId);
  return {
    ticketId: ticket.id,
    registrationId: ticket.registrationId,
    event: { id: ticket.registration.event.id, title: ticket.registration.event.title },
    participant: ticket.registration.user,
    registrationStatus: ticket.registration.status,
    attendance: await prisma.attendance.findUnique({
      where: { registrationId: ticket.registrationId },
    }),
  };
}
export async function checkIn(token, actorId, eventId, location) {
  const ticket = await findTicket(token, eventId);
  const event = ticket.registration.event;
  const now = new Date();
  if (
    event.status === "CANCELLED" ||
    event.status === "COMPLETED" ||
    now < event.startAt ||
    now > event.endAt
  )
    throw new AppError("Event is not currently active", 409, "EVENT_NOT_ACTIVE");
  validateLocation(event, location);
  const attendance = await prisma.$transaction(async (tx) => {
    const existing = await tx.attendance.findUnique({
      where: { registrationId: ticket.registrationId },
    });
    if (existing?.checkInAt)
      throw new AppError("Participant has already checked in", 409, "DUPLICATE_CHECK_IN");
    const row = existing
      ? await tx.attendance.update({
          where: { id: existing.id },
          data: { checkInAt: now, checkInMethod: "QR", status: "CHECKED_IN" },
        })
      : await tx.attendance.create({
          data: {
            eventId: event.id,
            registrationId: ticket.registrationId,
            userId: ticket.registration.userId,
            checkInAt: now,
            checkInMethod: "QR",
            status: "CHECKED_IN",
          },
        });
    await tx.registration.update({
      where: { id: ticket.registrationId },
      data: { status: "CHECKED_IN" },
    });
    return row;
  });
  return { attendance, participant: ticket.registration.user };
}
export async function checkOut(token, actorId, eventId, location) {
  const ticket = await findTicket(token, eventId);
  const event = ticket.registration.event;
  const now = new Date();
  validateLocation(event, location);
  const attendance = await prisma.attendance.findUnique({
    where: { registrationId: ticket.registrationId },
  });
  if (!attendance?.checkInAt)
    throw new AppError("Participant must check in before checking out", 409, "CHECK_IN_REQUIRED");
  if (attendance.checkOutAt)
    throw new AppError("Participant has already checked out", 409, "DUPLICATE_CHECK_OUT");
  const end = now < attendance.checkInAt ? attendance.checkInAt : now;
  const minutes = Math.max(0, Math.round((end.getTime() - attendance.checkInAt.getTime()) / 60000));
  const totalEventMinutes = Math.max(
    1,
    Math.round((event.endAt.getTime() - event.startAt.getTime()) / 60000),
  );
  const percentage = Math.min(100, Number(((minutes / totalEventMinutes) * 100).toFixed(2)));
  const status = percentage >= Number(event.minimumAttendancePercentage) ? "PRESENT" : "INCOMPLETE";
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.attendance.update({
      where: { id: attendance.id },
      data: {
        checkOutAt: end,
        checkOutMethod: "QR",
        attendanceMinutes: minutes,
        attendancePercentage: percentage,
        status,
      },
    });
    await tx.registration.update({
      where: { id: ticket.registrationId },
      data: { status: "CHECKED_OUT" },
    });
    return row;
  });
  return { attendance: updated, participant: ticket.registration.user };
}
export async function overrideAttendance(id, actorId, input) {
  if (!input.reason.trim())
    throw new AppError("An override reason is required", 422, "OVERRIDE_REASON_REQUIRED");
  const old = await prisma.attendance.findUnique({ where: { id } });
  if (!old) throw new AppError("Attendance record not found", 404, "ATTENDANCE_NOT_FOUND");
  const updated = await prisma.attendance.update({
    where: { id },
    data: {
      status: input.status,
      attendancePercentage: input.attendancePercentage,
      verifiedById: actorId,
      overrideReason: input.reason,
    },
  });
  await prisma.auditLog.create({
    data: {
      actorId,
      action: "ATTENDANCE_MANUAL_OVERRIDE",
      resourceType: "Attendance",
      resourceId: id,
      oldValue: old,
      newValue: updated,
      metadata: { reason: input.reason },
    },
  });
  return updated;
}
export async function listEventAttendance(eventId) {
  return prisma.attendance.findMany({
    where: { eventId },
    include: {
      user: {
        select: { id: true, fullName: true, email: true, department: true, enrollmentNumber: true },
      },
      registration: { select: { registrationNumber: true, status: true } },
    },
    orderBy: { checkInAt: "desc" },
  });
}
//# sourceMappingURL=attendance.service.js.map
