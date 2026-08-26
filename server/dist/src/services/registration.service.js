import { prisma } from "../prisma.js";
import { hashToken, opaqueToken, sequenceValue } from "../utils/crypto.js";
import { AppError } from "../utils/http.js";
import { notifyUsers } from "./notification.service.js";
async function nextNumber(tx, prefix, year) {
  const key = `${prefix}-${year}`;
  await tx.sequenceCounter.upsert({ where: { key }, update: {}, create: { key, value: 0 } });
  const counter = await tx.sequenceCounter.update({
    where: { key },
    data: { value: { increment: 1 } },
  });
  return sequenceValue(prefix, year, counter.value);
}
function isConfirmed(status) {
  return ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "COMPLETED"].includes(status);
}
export async function registerForEvent(eventId, userId, answers) {
  const result = await prisma.$transaction(async (tx) => {
    const event = await tx.event.findFirst({ where: { id: eventId, deletedAt: null } });
    if (!event) throw new AppError("Event not found", 404, "EVENT_NOT_FOUND");
    const now = new Date();
    if (event.status !== "PUBLISHED")
      throw new AppError("This event is not open for registration", 409, "EVENT_NOT_OPEN");
    if (now < event.registrationStartAt)
      throw new AppError("Registration has not opened yet", 409, "REGISTRATION_NOT_OPEN");
    if (now > event.registrationEndAt)
      throw new AppError("Registration period is closed", 409, "REGISTRATION_CLOSED");
    const existing = await tx.registration.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    if (existing && existing.status !== "CANCELLED")
      throw new AppError(
        "You are already registered for this event",
        409,
        "DUPLICATE_REGISTRATION",
      );
    let hasSeat = false;
    if (!event.approvalRequired) {
      const seat = await tx.event.updateMany({
        where: { id: eventId, status: "PUBLISHED", confirmedCount: { lt: event.capacity } },
        data: { confirmedCount: { increment: 1 } },
      });
      hasSeat = seat.count === 1;
    }
    const status = event.approvalRequired
      ? "PENDING"
      : hasSeat
        ? "CONFIRMED"
        : event.waitlistEnabled
          ? "WAITLISTED"
          : (() => {
              throw new AppError("This event is full", 409, "EVENT_FULL");
            })();
    const registrationNumber = await nextNumber(tx, "EVT", now.getUTCFullYear());
    const registration = existing
      ? await tx.registration.update({
          where: { id: existing.id },
          data: {
            status,
            customFormAnswers: answers,
            registeredAt: now,
            cancelledAt: null,
            registrationNumber,
          },
        })
      : await tx.registration.create({
          data: {
            eventId,
            userId,
            status,
            customFormAnswers: answers,
            registrationNumber,
          },
        });
    let ticketToken;
    if (status === "CONFIRMED") {
      ticketToken = opaqueToken(32);
      await tx.ticket.upsert({
        where: { registrationId: registration.id },
        update: {
          tokenHash: hashToken(ticketToken),
          nonce: opaqueToken(16),
          status: "ACTIVE",
          revokedAt: null,
        },
        create: {
          registrationId: registration.id,
          tokenHash: hashToken(ticketToken),
          nonce: opaqueToken(16),
          status: "ACTIVE",
        },
      });
      await tx.registration.update({
        where: { id: registration.id },
        data: { confirmedAt: now },
      });
    }
    return { registrationId: registration.id, registrationNumber, status, ticketToken };
  });
  if (result.status === "CONFIRMED")
    await notifyUsers(
      [userId],
      "REGISTRATION_CONFIRMED",
      "Registration confirmed",
      `Your registration ${result.registrationNumber} is confirmed.`,
    );
  return result;
}
export async function listUserRegistrations(userId, page, limit) {
  const where = { userId };
  const [total, rows] = await prisma.$transaction([
    prisma.registration.count({ where }),
    prisma.registration.findMany({
      where,
      include: {
        event: {
          select: {
            id: true,
            slug: true,
            title: true,
            startAt: true,
            endAt: true,
            venueName: true,
            bannerUrl: true,
          },
        },
        ticket: true,
        attendance: true,
      },
      orderBy: { registeredAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  return { total, rows };
}
export async function getRegistration(id, userId) {
  const registration = await prisma.registration.findUnique({
    where: { id },
    include: {
      event: true,
      user: {
        select: { id: true, fullName: true, email: true, department: true, enrollmentNumber: true },
      },
      ticket: true,
      attendance: true,
      answers: true,
    },
  });
  if (!registration || (userId && registration.userId !== userId))
    throw new AppError("Registration not found", 404, "REGISTRATION_NOT_FOUND");
  return registration;
}
export async function issueTicket(id, userId) {
  const registration = await getRegistration(id, userId);
  if (!isConfirmed(registration.status))
    throw new AppError(
      "A ticket is available only for a confirmed registration",
      409,
      "TICKET_NOT_AVAILABLE",
    );
  const token = opaqueToken(32);
  await prisma.$transaction(async (tx) => {
    await tx.ticket.updateMany({
      where: { registrationId: id, status: "ACTIVE" },
      data: { status: "REVOKED", revokedAt: new Date() },
    });
    await tx.ticket.create({
      data: {
        registrationId: id,
        tokenHash: hashToken(token),
        nonce: opaqueToken(16),
        status: "ACTIVE",
      },
    });
  });
  return { registrationId: id, ticketToken: token };
}
export async function cancelRegistration(id, userId) {
  const registration = await getRegistration(id, userId);
  if (["CANCELLED", "CHECKED_OUT", "COMPLETED"].includes(registration.status))
    throw new AppError("This registration cannot be cancelled", 409, "INVALID_REGISTRATION_STATE");
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.registration.update({
      where: { id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
      include: { event: true },
    });
    if (isConfirmed(registration.status)) {
      await tx.event.updateMany({
        where: { id: registration.eventId, confirmedCount: { gt: 0 } },
        data: { confirmedCount: { decrement: 1 } },
      });
      await promoteWaitlisted(tx, registration.eventId);
    }
    if (registration.ticket)
      await tx.ticket.update({
        where: { id: registration.ticket.id },
        data: { status: "REVOKED", revokedAt: new Date() },
      });
    return row;
  });
  return updated;
}
export async function promoteWaitlisted(tx, eventId) {
  const event = await tx.event.findUnique({ where: { id: eventId } });
  if (!event) return;
  const reserved = await tx.event.updateMany({
    where: { id: eventId, confirmedCount: { lt: event.capacity } },
    data: { confirmedCount: { increment: 1 } },
  });
  if (reserved.count !== 1) return;
  const candidate = await tx.registration.findFirst({
    where: { eventId, status: "WAITLISTED" },
    orderBy: { registeredAt: "asc" },
  });
  if (!candidate) {
    await tx.event.updateMany({
      where: { id: eventId, confirmedCount: { gt: 0 } },
      data: { confirmedCount: { decrement: 1 } },
    });
    return;
  }
  const ticketToken = opaqueToken(32);
  await tx.registration.update({
    where: { id: candidate.id },
    data: { status: "CONFIRMED", confirmedAt: new Date() },
  });
  await tx.ticket.create({
    data: {
      registrationId: candidate.id,
      tokenHash: hashToken(ticketToken),
      nonce: opaqueToken(16),
    },
  });
  await notifyUsers(
    [candidate.userId],
    "WAITLIST_PROMOTED",
    "You are off the waitlist",
    `Registration ${candidate.registrationNumber} is now confirmed.`,
  );
}
export async function listAllRegistrations(input) {
  const where = {
    ...(input.eventId ? { eventId: input.eventId } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.search
      ? {
          OR: [
            { registrationNumber: { contains: input.search, mode: "insensitive" } },
            { user: { fullName: { contains: input.search, mode: "insensitive" } } },
            { user: { email: { contains: input.search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [total, rows] = await prisma.$transaction([
    prisma.registration.count({ where }),
    prisma.registration.findMany({
      where,
      include: {
        event: { select: { title: true, slug: true } },
        user: { select: { fullName: true, email: true, department: true, enrollmentNumber: true } },
        attendance: true,
      },
      orderBy: { registeredAt: "desc" },
      skip: (input.page - 1) * input.limit,
      take: input.limit,
    }),
  ]);
  return { total, rows };
}
//# sourceMappingURL=registration.service.js.map
