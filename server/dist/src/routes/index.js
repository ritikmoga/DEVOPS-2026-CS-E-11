import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { EventStatus, ProofStatus, ProofType, RegistrationStatus } from "@prisma/client";
import { prisma } from "../prisma.js";
import { env } from "../config/env.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { asyncHandler, AppError, created, ok, pagination } from "../utils/http.js";
import * as auth from "../services/auth.service.js";
import * as events from "../services/event.service.js";
import * as registrations from "../services/registration.service.js";
import * as attendance from "../services/attendance.service.js";
import * as teams from "../services/team.service.js";
import * as proofs from "../services/proof.service.js";
import * as certificates from "../services/certificate.service.js";
import { listNotifications } from "../services/notification.service.js";
import { audit } from "../services/audit.service.js";
import { recordPublicLogin } from "../services/login-audit.service.js";
import { storage } from "../storage/storage.service.js";
const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_DOCUMENT_BYTES },
});
const date = z.coerce.date();
function q(value) {
  return typeof value === "string" && value.length ? value : undefined;
}
function param(req, key) {
  return String(req.params[key]);
}
function pageParams(query) {
  const page = Math.max(1, Number(q(query.page) ?? 1));
  const limit = Math.min(100, Math.max(1, Number(q(query.limit) ?? 20)));
  return { page: Number.isFinite(page) ? page : 1, limit: Number.isFinite(limit) ? limit : 20 };
}
function setRefreshCookie(res, token) {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: "/api/v1/auth",
  });
}
function refreshFrom(req) {
  return req.cookies?.refreshToken || req.body?.refreshToken;
}
const authRouter = Router();
authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        email: z.string().email(),
        password: z.string().min(8),
        confirmPassword: z.string().optional(),
        fullName: z.string().min(2).max(120),
        phone: z.string().optional(),
        college: z.string().optional(),
        department: z.string().optional(),
        semester: z.coerce.number().int().min(1).max(12).optional(),
        year: z.coerce.number().int().min(1).max(10).optional(),
        enrollmentNumber: z.string().max(64).optional(),
      })
      .refine((value) => !value.confirmPassword || value.password === value.confirmPassword, {
        path: ["confirmPassword"],
        message: "Passwords do not match",
      })
      .parse(req.body);
    const { confirmPassword: _confirmPassword, ...input } = body;
    return created(
      res,
      await auth.register(input),
      "Account created. Check your email to verify it.",
    );
  }),
);
authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = z
      .object({ email: z.string().email(), password: z.string().min(1) })
      .parse(req.body);
    const metadata = {
      userAgent: req.get("user-agent"),
      ipAddress: req.ip,
    };
    let result;
    try {
      result = await auth.login(body.email, body.password, metadata);
    } catch (error) {
      await recordPublicLogin({
        email: body.email,
        success: false,
        reason: error?.code === "INVALID_CREDENTIALS" ? "INVALID_CREDENTIALS" : "LOGIN_FAILED",
        ...metadata,
      }).catch((auditError) =>
        console.error("Could not write public login audit record", auditError),
      );
      throw error;
    }
    await recordPublicLogin({
      email: body.email,
      userId: result.user.id,
      success: true,
      ...metadata,
    }).catch((auditError) =>
      console.error("Could not write public login audit record", auditError),
    );
    setRefreshCookie(res, result.refreshToken);
    return ok(res, { accessToken: result.accessToken, user: result.user }, "Login successful");
  }),
);
authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const result = await auth.refresh(refreshFrom(req), {
      userAgent: req.get("user-agent"),
      ipAddress: req.ip,
    });
    setRefreshCookie(res, result.refreshToken);
    return ok(res, { accessToken: result.accessToken });
  }),
);
authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    await auth.logout(refreshFrom(req));
    res.clearCookie("refreshToken", { path: "/api/v1/auth" });
    return ok(res, null, "Logged out");
  }),
);
authRouter.post(
  "/logout-all",
  requireAuth,
  asyncHandler(async (req, res) => {
    await auth.logoutAll(req.user.id);
    res.clearCookie("refreshToken", { path: "/api/v1/auth" });
    return ok(res, null, "All sessions revoked");
  }),
);
authRouter.post(
  "/verify-email",
  asyncHandler(async (req, res) => {
    const body = z.object({ token: z.string().min(10) }).parse(req.body);
    await auth.verifyEmail(body.token);
    return ok(res, null, "Email verified");
  }),
);
authRouter.post(
  "/forgot-password",
  asyncHandler(async (req, res) => {
    const body = z.object({ email: z.string().email() }).parse(req.body);
    await auth.requestPasswordReset(body.email);
    return ok(res, null, "If the account exists, reset instructions have been sent");
  }),
);
authRouter.post(
  "/reset-password",
  asyncHandler(async (req, res) => {
    const body = z
      .object({ token: z.string().min(10), password: z.string().min(8) })
      .parse(req.body);
    await auth.resetPassword(body.token, body.password);
    return ok(res, null, "Password reset successful");
  }),
);
authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => ok(res, req.user)),
);
router.use("/auth", authRouter);
const publicRouter = Router();
router.get(
  "/files",
  requireAuth,
  asyncHandler(async (req, res) => {
    const key = q(req.query.key);
    if (!key) throw new AppError("File key is required", 400, "FILE_KEY_REQUIRED");
    const [proof, certificate] = await Promise.all([
      prisma.proof.findFirst({
        where: { storageKey: key },
        select: { userId: true, mimeType: true },
      }),
      prisma.certificate.findFirst({ where: { storageKey: key }, select: { userId: true } }),
    ]);
    const ownerId = proof?.userId || certificate?.userId;
    if (!ownerId) throw new AppError("File not found", 404, "FILE_NOT_FOUND");
    if (
      ownerId !== req.user.id &&
      !req.user.permissions.includes("PROOF_REVIEW") &&
      !req.user.permissions.includes("CERTIFICATE_GENERATE")
    )
      throw new AppError("You do not have access to this file", 403, "FORBIDDEN");
    const buffer = await storage.read(key);
    if (proof?.mimeType) res.type(proof.mimeType);
    return res.send(buffer);
  }),
);
publicRouter.get(
  "/events",
  asyncHandler(async (req, res) => {
    const params = pageParams(req.query);
    const status = q(req.query.status);
    const result = await events.listEvents({
      ...params,
      search: q(req.query.search),
      category: q(req.query.category),
      status: status && Object.values(EventStatus).includes(status) ? status : undefined,
      mode: q(req.query.mode),
      from: q(req.query.from) ? new Date(q(req.query.from)) : undefined,
      to: q(req.query.to) ? new Date(q(req.query.to)) : undefined,
      sort: q(req.query.sort),
    });
    return res.json({
      success: true,
      data: result.rows,
      pagination: pagination(params.page, params.limit, result.total),
    });
  }),
);
publicRouter.get(
  "/events/:slug",
  asyncHandler(async (req, res) => ok(res, await events.getEventBySlug(param(req, "slug")))),
);
publicRouter.get(
  "/event-categories",
  asyncHandler(async (_req, res) =>
    ok(res, await prisma.eventCategory.findMany({ orderBy: { name: "asc" } })),
  ),
);
publicRouter.get(
  "/stats",
  asyncHandler(async (_req, res) => {
    const [eventsCount, usersCount, registrationsCount, certificatesCount] =
      await prisma.$transaction([
        prisma.event.count({ where: { deletedAt: null } }),
        prisma.user.count({ where: { deletedAt: null, isActive: true } }),
        prisma.registration.count(),
        prisma.certificate.count({ where: { status: "ISSUED" } }),
      ]);
    return ok(res, {
      events: eventsCount,
      users: usersCount,
      registrations: registrationsCount,
      certificates: certificatesCount,
    });
  }),
);
publicRouter.get(
  "/certificates/verify/:certificateNumber",
  asyncHandler(async (req, res) =>
    ok(res, await certificates.verifyCertificate(param(req, "certificateNumber"))),
  ),
);
router.use(publicRouter);
const userRouter = Router();
userRouter.use(requireAuth);
userRouter.get(
  "/registrations/me",
  asyncHandler(async (req, res) => {
    const params = pageParams(req.query);
    const result = await registrations.listUserRegistrations(
      req.user.id,
      params.page,
      params.limit,
    );
    return res.json({
      success: true,
      data: result.rows,
      pagination: pagination(params.page, params.limit, result.total),
    });
  }),
);
userRouter.post(
  "/events/:eventId/register",
  asyncHandler(async (req, res) =>
    created(
      res,
      await registrations.registerForEvent(param(req, "eventId"), req.user.id, req.body?.answers),
      "Registration completed successfully",
    ),
  ),
);
userRouter.get(
  "/registrations/:id",
  asyncHandler(async (req, res) =>
    ok(res, await registrations.getRegistration(param(req, "id"), req.user.id)),
  ),
);
userRouter.post(
  "/registrations/:id/ticket",
  asyncHandler(async (req, res) =>
    ok(res, await registrations.issueTicket(param(req, "id"), req.user.id), "Ticket issued"),
  ),
);
userRouter.patch(
  "/registrations/:id/cancel",
  asyncHandler(async (req, res) =>
    ok(
      res,
      await registrations.cancelRegistration(param(req, "id"), req.user.id),
      "Registration cancelled",
    ),
  ),
);
userRouter.post(
  "/events/:eventId/teams",
  asyncHandler(async (req, res) => {
    const body = z.object({ name: z.string().min(2).max(100) }).parse(req.body);
    return created(res, await teams.createTeam(param(req, "eventId"), req.user.id, body.name));
  }),
);
userRouter.post(
  "/teams/join",
  asyncHandler(async (req, res) => {
    const body = z.object({ inviteCode: z.string().min(4) }).parse(req.body);
    return ok(res, await teams.joinTeam(body.inviteCode, req.user.id), "Joined team");
  }),
);
userRouter.get(
  "/teams/:id",
  asyncHandler(async (req, res) => ok(res, await teams.getTeam(param(req, "id")))),
);
userRouter.post(
  "/teams/:id/leave",
  asyncHandler(async (req, res) => {
    await teams.leaveTeam(param(req, "id"), req.user.id);
    return ok(res, null, "Left team");
  }),
);
userRouter.post(
  "/proofs/upload",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new AppError("A proof file is required", 422, "FILE_REQUIRED");
    const body = z
      .object({
        eventId: z.string().uuid(),
        type: z.nativeEnum(ProofType),
      })
      .parse(req.body);
    return created(
      res,
      await proofs.uploadProof(
        {
          ...body,
          userId: req.user.id,
          buffer: req.file.buffer,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
        },
        req,
      ),
      "Proof uploaded",
    );
  }),
);
userRouter.get(
  "/proofs/:id",
  asyncHandler(async (req, res) => ok(res, await proofs.getProof(param(req, "id"), req.user.id))),
);
userRouter.delete(
  "/proofs/:id",
  asyncHandler(async (req, res) => {
    const proof = await proofs.getProof(param(req, "id"), req.user.id);
    if (proof.verificationStatus !== "PENDING" && proof.verificationStatus !== "DUPLICATE")
      throw new AppError("Reviewed proofs cannot be deleted", 409, "PROOF_LOCKED");
    await storage.delete(proof.storageKey);
    await prisma.proof.delete({ where: { id: proof.id } });
    return ok(res, null, "Proof deleted");
  }),
);
userRouter.get(
  "/certificates/me",
  asyncHandler(async (req, res) => ok(res, await certificates.listMyCertificates(req.user.id))),
);
userRouter.get(
  "/notifications",
  asyncHandler(async (req, res) => {
    const params = pageParams(req.query);
    const result = await listNotifications(req.user.id, params.page, params.limit);
    return res.json({
      success: true,
      data: result.rows,
      pagination: pagination(params.page, params.limit, result.total),
    });
  }),
);
userRouter.patch(
  "/notifications/:id/read",
  asyncHandler(async (req, res) => {
    await prisma.notificationRecipient.updateMany({
      where: { id: param(req, "id"), userId: req.user.id },
      data: { readAt: new Date() },
    });
    return ok(res, null, "Notification marked read");
  }),
);
userRouter.patch(
  "/notifications/read-all",
  asyncHandler(async (req, res) => {
    await prisma.notificationRecipient.updateMany({
      where: { userId: req.user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return ok(res, null, "Notifications marked read");
  }),
);
userRouter.get(
  "/profile",
  asyncHandler(async (req, res) =>
    ok(
      res,
      await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          college: true,
          department: true,
          semester: true,
          year: true,
          enrollmentNumber: true,
        },
      }),
    ),
  ),
);
userRouter.patch(
  "/profile",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        fullName: z.string().min(2).max(120),
        phone: z.string().optional(),
        college: z.string().optional(),
        department: z.string().optional(),
        semester: z.number().int().optional(),
        year: z.number().int().optional(),
      })
      .parse(req.body);
    return ok(
      res,
      await prisma.user.update({ where: { id: req.user.id }, data: body }),
      "Profile updated",
    );
  }),
);
router.use(userRouter);
const adminRouter = Router();
adminRouter.use(requireAuth);
adminRouter.get(
  "/events",
  requirePermission("REGISTRATION_VIEW"),
  asyncHandler(async (req, res) => {
    const params = pageParams(req.query);
    const where = {
      deletedAt: null,
      ...(q(req.query.status) ? { status: q(req.query.status) } : {}),
      ...(q(req.query.search)
        ? { title: { contains: q(req.query.search), mode: "insensitive" } }
        : {}),
    };
    const [total, rows] = await prisma.$transaction([
      prisma.event.count({ where }),
      prisma.event.findMany({
        where,
        include: { category: true, organizer: true, _count: { select: { registrations: true } } },
        orderBy: { startAt: "desc" },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
    ]);
    return res.json({
      success: true,
      data: rows,
      pagination: pagination(params.page, params.limit, total),
    });
  }),
);
const eventInput = z.object({
  title: z.string().min(3),
  shortDescription: z.string().min(5),
  description: z.string().min(5),
  categoryId: z.string().uuid().optional(),
  organizerId: z.string().uuid().optional(),
  mode: z.enum(["ONLINE", "OFFLINE", "HYBRID"]).optional(),
  venueName: z.string().optional(),
  venueAddress: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  allowedRadiusMeters: z.number().int().positive().optional(),
  startAt: date,
  endAt: date,
  registrationStartAt: date,
  registrationEndAt: date,
  capacity: z.number().int().positive(),
  registrationType: z.enum(["INDIVIDUAL", "TEAM"]).optional(),
  approvalRequired: z.boolean().optional(),
  waitlistEnabled: z.boolean().optional(),
  minTeamSize: z.number().int().positive().optional(),
  maxTeamSize: z.number().int().positive().optional(),
  attendanceEnabled: z.boolean().optional(),
  minimumAttendancePercentage: z.number().min(0).max(100).optional(),
  certificateEnabled: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  rules: z.unknown().optional(),
  schedule: z.unknown().optional(),
  speakers: z.unknown().optional(),
  prizes: z.unknown().optional(),
  contactDetails: z.unknown().optional(),
});
adminRouter.post(
  "/events",
  requirePermission("EVENT_CREATE"),
  asyncHandler(async (req, res) =>
    created(
      res,
      await events.createEvent(eventInput.parse(req.body), req.user.id),
      "Event created",
    ),
  ),
);
adminRouter.get(
  "/events/:id",
  requirePermission("REGISTRATION_VIEW"),
  asyncHandler(async (req, res) => ok(res, await events.getEventById(param(req, "id")))),
);
adminRouter.patch(
  "/events/:id",
  requirePermission("EVENT_UPDATE"),
  asyncHandler(async (req, res) => {
    const id = param(req, "id");
    const old = await events.getEventById(id);
    const updated = await events.updateEvent(id, eventInput.partial().parse(req.body));
    await audit(req, "EVENT_EDITED", "Event", id, old, updated);
    return ok(res, updated, "Event updated");
  }),
);
adminRouter.post(
  "/events/:id/publish",
  requirePermission("EVENT_PUBLISH"),
  asyncHandler(async (req, res) => {
    const id = param(req, "id");
    const updated = await events.transitionEvent(id, "PUBLISHED");
    await audit(req, "EVENT_PUBLISHED", "Event", id, undefined, updated);
    return ok(res, updated, "Event published");
  }),
);
adminRouter.post(
  "/events/:id/cancel",
  requirePermission("EVENT_UPDATE"),
  asyncHandler(async (req, res) => {
    const id = param(req, "id");
    const updated = await events.transitionEvent(id, "CANCELLED");
    await audit(req, "EVENT_CANCELLED", "Event", id, undefined, updated);
    return ok(res, updated, "Event cancelled");
  }),
);
adminRouter.post(
  "/events/:id/archive",
  requirePermission("EVENT_UPDATE"),
  asyncHandler(async (req, res) =>
    ok(res, await events.transitionEvent(param(req, "id"), "ARCHIVED"), "Event archived"),
  ),
);
adminRouter.get(
  "/registrations",
  requirePermission("REGISTRATION_VIEW"),
  asyncHandler(async (req, res) => {
    const params = pageParams(req.query);
    const status = q(req.query.status);
    const result = await registrations.listAllRegistrations({
      ...params,
      eventId: q(req.query.eventId),
      status: status && Object.values(RegistrationStatus).includes(status) ? status : undefined,
      search: q(req.query.search),
    });
    return res.json({
      success: true,
      data: result.rows,
      pagination: pagination(params.page, params.limit, result.total),
    });
  }),
);
adminRouter.get(
  "/events/:eventId/registrations",
  requirePermission("REGISTRATION_VIEW"),
  asyncHandler(async (req, res) => {
    const params = pageParams(req.query);
    const result = await registrations.listAllRegistrations({
      ...params,
      eventId: param(req, "eventId"),
    });
    return res.json({
      success: true,
      data: result.rows,
      pagination: pagination(params.page, params.limit, result.total),
    });
  }),
);
adminRouter.patch(
  "/registrations/:id/status",
  requirePermission("REGISTRATION_APPROVE"),
  asyncHandler(async (req, res) => {
    const id = param(req, "id");
    const body = z.object({ status: z.nativeEnum(RegistrationStatus) }).parse(req.body);
    const old = await prisma.registration.findUniqueOrThrow({ where: { id } });
    const updated = await prisma.registration.update({
      where: { id },
      data: { status: body.status },
    });
    await audit(req, "REGISTRATION_STATUS_CHANGED", "Registration", id, old, updated);
    return ok(res, updated, "Registration status updated");
  }),
);
adminRouter.post(
  "/attendance/validate-ticket",
  requirePermission("ATTENDANCE_SCAN"),
  asyncHandler(async (req, res) => {
    const body = z
      .object({ token: z.string().min(10), eventId: z.string().uuid().optional() })
      .parse(req.body);
    return ok(res, await attendance.validateTicket(body.token, body.eventId));
  }),
);
adminRouter.post(
  "/attendance/check-in",
  requirePermission("ATTENDANCE_SCAN"),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        token: z.string().min(10),
        eventId: z.string().uuid().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
      })
      .parse(req.body);
    return ok(res, await attendance.checkIn(body.token, req.user.id, body.eventId, body));
  }),
);
adminRouter.post(
  "/attendance/check-out",
  requirePermission("ATTENDANCE_SCAN"),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        token: z.string().min(10),
        eventId: z.string().uuid().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
      })
      .parse(req.body);
    return ok(res, await attendance.checkOut(body.token, req.user.id, body.eventId, body));
  }),
);
adminRouter.patch(
  "/attendance/:id",
  requirePermission("ATTENDANCE_EDIT"),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        status: z.enum(["PRESENT", "INCOMPLETE", "ABSENT", "MANUAL_OVERRIDE"]),
        reason: z.string().min(3),
        attendancePercentage: z.number().min(0).max(100).optional(),
      })
      .parse(req.body);
    return ok(
      res,
      await attendance.overrideAttendance(param(req, "id"), req.user.id, body),
      "Attendance overridden",
    );
  }),
);
adminRouter.get(
  "/events/:eventId/attendance",
  requirePermission("REGISTRATION_VIEW"),
  asyncHandler(async (req, res) =>
    ok(res, await attendance.listEventAttendance(param(req, "eventId"))),
  ),
);
adminRouter.get(
  "/proofs",
  requirePermission("PROOF_REVIEW"),
  asyncHandler(async (req, res) => {
    const params = pageParams(req.query);
    const status = q(req.query.status);
    const result = await proofs.listProofs({
      ...params,
      eventId: q(req.query.eventId),
      status: status && Object.values(ProofStatus).includes(status) ? status : undefined,
    });
    return res.json({
      success: true,
      data: result.rows,
      pagination: pagination(params.page, params.limit, result.total),
    });
  }),
);
adminRouter.get(
  "/proofs/:id",
  requirePermission("PROOF_REVIEW"),
  asyncHandler(async (req, res) => ok(res, await proofs.getProof(param(req, "id")))),
);
adminRouter.post(
  "/proofs/:id/verify",
  requirePermission("PROOF_REVIEW"),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await proofs.reviewProof(
        param(req, "id"),
        req.user.id,
        "VERIFIED",
        req.body?.metadata ?? { reviewer: "manual" },
        req,
      ),
      "Proof verified",
    ),
  ),
);
adminRouter.post(
  "/proofs/:id/reject",
  requirePermission("PROOF_REVIEW"),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await proofs.reviewProof(
        param(req, "id"),
        req.user.id,
        "REJECTED",
        req.body?.metadata ?? { reviewer: "manual" },
        req,
      ),
      "Proof rejected",
    ),
  ),
);
adminRouter.post(
  "/proofs/:id/flag",
  requirePermission("PROOF_REVIEW"),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await proofs.reviewProof(
        param(req, "id"),
        req.user.id,
        "FLAGGED",
        req.body?.metadata ?? { reviewer: "manual" },
        req,
      ),
      "Proof flagged",
    ),
  ),
);
adminRouter.post(
  "/events/:eventId/certificates/generate",
  requirePermission("CERTIFICATE_GENERATE"),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await certificates.generateCertificates(param(req, "eventId"), req.user.id, req),
      "Certificates generated",
    ),
  ),
);
adminRouter.post(
  "/certificates/:id/revoke",
  requirePermission("CERTIFICATE_GENERATE"),
  asyncHandler(async (req, res) =>
    ok(res, await certificates.revokeCertificate(param(req, "id"), req), "Certificate revoked"),
  ),
);
adminRouter.get(
  "/analytics/overview",
  requirePermission("REPORT_EXPORT"),
  asyncHandler(async (_req, res) => {
    const [
      totalEvents,
      upcomingEvents,
      activeEvents,
      completedEvents,
      totalUsers,
      registrations,
      pendingProofs,
      checkins,
    ] = await prisma.$transaction([
      prisma.event.count({ where: { deletedAt: null } }),
      prisma.event.count({ where: { status: "PUBLISHED", startAt: { gt: new Date() } } }),
      prisma.event.count({ where: { status: "ONGOING" } }),
      prisma.event.count({ where: { status: "COMPLETED" } }),
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.registration.count(),
      prisma.proof.count({
        where: { verificationStatus: { in: ["PENDING", "FLAGGED", "DUPLICATE"] } },
      }),
      prisma.attendance.count({ where: { checkInAt: { not: null } } }),
    ]);
    return ok(res, {
      totalEvents,
      upcomingEvents,
      activeEvents,
      completedEvents,
      totalUsers,
      registrations,
      pendingProofs,
      todayCheckins: checkins,
    });
  }),
);
adminRouter.get(
  "/audit-logs",
  requirePermission("AUDIT_LOG_VIEW"),
  asyncHandler(async (req, res) => {
    const params = pageParams(req.query);
    const [total, rows] = await prisma.$transaction([
      prisma.auditLog.count(),
      prisma.auditLog.findMany({
        include: { actor: { select: { fullName: true, email: true } } },
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
    ]);
    return res.json({
      success: true,
      data: rows,
      pagination: pagination(params.page, params.limit, total),
    });
  }),
);
adminRouter.get(
  "/reports/registrations",
  requirePermission("REPORT_EXPORT"),
  asyncHandler(async (req, res) => {
    const result = await registrations.listAllRegistrations({
      page: 1,
      limit: 10000,
      eventId: q(req.query.eventId),
      search: q(req.query.search),
    });
    const header = "Registration Number,Participant,Email,Department,Event,Status,Attendance\n";
    const csv =
      header +
      result.rows
        .map((row) =>
          [
            row.registrationNumber,
            row.user.fullName,
            row.user.email,
            row.user.department ?? "",
            row.event.title,
            row.status,
            row.attendance?.status ?? "NOT_MARKED",
          ]
            .map((value) => `"${String(value).replaceAll('"', '""')}"`)
            .join(","),
        )
        .join("\n");
    res.type("text/csv").attachment("registrations.csv").send(csv);
  }),
);
adminRouter.get(
  "/users",
  requirePermission("USER_MANAGE"),
  asyncHandler(async (req, res) => {
    const params = pageParams(req.query);
    const where = {
      deletedAt: null,
      ...(q(req.query.search)
        ? {
            OR: [
              { fullName: { contains: q(req.query.search), mode: "insensitive" } },
              { email: { contains: q(req.query.search), mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [total, rows] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          fullName: true,
          department: true,
          isActive: true,
          createdAt: true,
          roles: { include: { role: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
    ]);
    return res.json({
      success: true,
      data: rows,
      pagination: pagination(params.page, params.limit, total),
    });
  }),
);
adminRouter.patch(
  "/users/:id/status",
  requirePermission("USER_MANAGE"),
  asyncHandler(async (req, res) => {
    const id = param(req, "id");
    const body = z.object({ isActive: z.boolean() }).parse(req.body);
    const old = await prisma.user.findUniqueOrThrow({ where: { id }, select: { isActive: true } });
    const updated = await prisma.user.update({ where: { id }, data: { isActive: body.isActive } });
    await audit(
      req,
      body.isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED",
      "User",
      id,
      old,
      updated,
    );
    return ok(res, updated, "User status updated");
  }),
);
router.use("/admin", adminRouter);
export default router;
//# sourceMappingURL=index.js.map
