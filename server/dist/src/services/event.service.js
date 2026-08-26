import { prisma } from "../prisma.js";
import { AppError } from "../utils/http.js";
import { slugify } from "../utils/crypto.js";
const transitions = {
  DRAFT: ["PUBLISHED", "CANCELLED"],
  PUBLISHED: ["REGISTRATION_CLOSED", "ONGOING", "CANCELLED"],
  REGISTRATION_CLOSED: ["ONGOING", "CANCELLED"],
  ONGOING: ["COMPLETED", "CANCELLED"],
  COMPLETED: ["ARCHIVED"],
  CANCELLED: ["ARCHIVED"],
  ARCHIVED: [],
};
export function assertEventTransition(from, to) {
  if (!transitions[from].includes(to))
    throw new AppError(
      `Invalid event status transition from ${from} to ${to}`,
      409,
      "INVALID_STATUS_TRANSITION",
    );
}
export async function listEvents(input) {
  const where = {
    deletedAt: null,
    ...(input.status
      ? { status: input.status }
      : { status: { in: ["PUBLISHED", "REGISTRATION_CLOSED", "ONGOING"] } }),
    ...(input.search
      ? {
          OR: [
            { title: { contains: input.search, mode: "insensitive" } },
            { shortDescription: { contains: input.search, mode: "insensitive" } },
            { city: { contains: input.search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(input.category ? { category: { name: input.category } } : {}),
    ...(input.mode ? { mode: input.mode } : {}),
    ...(input.from || input.to
      ? {
          startAt: {
            ...(input.from ? { gte: input.from } : {}),
            ...(input.to ? { lte: input.to } : {}),
          },
        }
      : {}),
  };
  const orderBy =
    input.sort === "popular"
      ? { registrations: { _count: "desc" } }
      : input.sort === "closing"
        ? { registrationEndAt: "asc" }
        : input.sort === "newest"
          ? { createdAt: "desc" }
          : { startAt: "asc" };
  const [total, rows] = await prisma.$transaction([
    prisma.event.count({ where }),
    prisma.event.findMany({
      where,
      orderBy,
      skip: (input.page - 1) * input.limit,
      take: input.limit,
      include: { category: true, organizer: true, _count: { select: { registrations: true } } },
    }),
  ]);
  return { rows, total };
}
export async function getEventBySlug(slug) {
  const event = await prisma.event.findFirst({
    where: { slug, deletedAt: null },
    include: {
      category: true,
      organizer: true,
      documents: true,
      _count: { select: { registrations: true } },
    },
  });
  if (!event) throw new AppError("Event not found", 404, "EVENT_NOT_FOUND");
  const confirmed = await prisma.registration.count({
    where: {
      eventId: event.id,
      status: { in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "COMPLETED"] },
    },
  });
  return { ...event, availableSeats: Math.max(event.capacity - confirmed, 0) };
}
export async function getEventById(id) {
  const event = await prisma.event.findUnique({
    where: { id },
    include: { category: true, organizer: true, documents: true },
  });
  if (!event) throw new AppError("Event not found", 404, "EVENT_NOT_FOUND");
  return event;
}
export async function createEvent(input, createdById) {
  const baseSlug = slugify(input.title);
  let slug = baseSlug;
  for (let suffix = 2; await prisma.event.findUnique({ where: { slug } }); suffix++)
    slug = `${baseSlug}-${suffix}`;
  return prisma.event.create({
    data: {
      ...input,
      slug,
      createdById,
      latitude: input.latitude,
      longitude: input.longitude,
      rules: input.rules,
      schedule: input.schedule,
      speakers: input.speakers,
      prizes: input.prizes,
      contactDetails: input.contactDetails,
      tags: input.tags ?? [],
      deletedAt: null,
    },
  });
}
export async function updateEvent(id, input) {
  await getEventById(id);
  return prisma.event.update({
    where: { id },
    data: {
      ...input,
      rules: input.rules,
      schedule: input.schedule,
      speakers: input.speakers,
      prizes: input.prizes,
      contactDetails: input.contactDetails,
    },
  });
}
export async function transitionEvent(id, status) {
  const event = await getEventById(id);
  assertEventTransition(event.status, status);
  return prisma.event.update({
    where: { id },
    data: { status, ...(status === "PUBLISHED" ? { publishedAt: new Date() } : {}) },
  });
}
//# sourceMappingURL=event.service.js.map
