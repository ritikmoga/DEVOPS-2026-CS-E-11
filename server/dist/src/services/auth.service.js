import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
const AuthTokenType = Object.freeze({
  EMAIL_VERIFICATION: "EMAIL_VERIFICATION",
  PASSWORD_RESET: "PASSWORD_RESET",
});
const RoleName = Object.freeze({ STUDENT: "STUDENT" });
import { prisma } from "../prisma.js";
import { env } from "../config/env.js";
import { hashToken, opaqueToken } from "../utils/crypto.js";
import { AppError } from "../utils/http.js";
import { sendEmail } from "./email.service.js";
function expiresInMs(value) {
  const match = value.match(/^(\d+)([smhd])$/);
  if (!match) return 30 * 24 * 60 * 60 * 1000;
  const units = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return Number(match[1]) * units[match[2]];
}
async function loadRoles(userId) {
  const roles = await prisma.userRole.findMany({
    where: { userId },
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  });
  return {
    roles: roles.map((item) => item.role.name),
    permissions: [
      ...new Set(
        roles.flatMap((item) => item.role.permissions.map((entry) => entry.permission.code)),
      ),
    ],
  };
}
export async function register(input) {
  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { email: input.email },
        ...(input.enrollmentNumber ? [{ enrollmentNumber: input.enrollmentNumber }] : []),
      ],
    },
  });
  if (existing)
    throw new AppError(
      "An account with this email or enrollment number already exists",
      409,
      "ACCOUNT_EXISTS",
    );
  const role = await prisma.role.findUnique({ where: { name: RoleName.STUDENT } });
  if (!role)
    throw new AppError("Default student role is not configured", 500, "ROLE_CONFIGURATION_ERROR");
  const passwordHash = await bcrypt.hash(input.password, 12);
  const verificationToken = opaqueToken();
  const { password: _password, ...profile } = input;
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        ...profile,
        email: input.email.toLowerCase(),
        passwordHash,
        deletedAt: null,
        roles: { create: { roleId: role.id } },
      },
      select: { id: true, email: true, fullName: true },
    });
    await tx.authToken.create({
      data: {
        userId: created.id,
        tokenHash: hashToken(verificationToken),
        type: AuthTokenType.EMAIL_VERIFICATION,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    return created;
  });
  await sendEmail(
    user.email,
    "Verify your EventHub account",
    `<p>Hello ${user.fullName}, verify your account using token <strong>${verificationToken}</strong>.</p>`,
  );
  return user;
}
export async function login(email, password, metadata) {
  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase(), deletedAt: null },
    select: {
      id: true,
      email: true,
      fullName: true,
      passwordHash: true,
      isActive: true,
      emailVerifiedAt: true,
    },
  });
  if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash)))
    throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
  const refreshToken = opaqueToken(48);
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      refreshTokenHash: hashToken(refreshToken),
      userAgent: metadata.userAgent,
      ipAddress: metadata.ipAddress,
      expiresAt: new Date(Date.now() + expiresInMs(env.REFRESH_TOKEN_EXPIRES_IN)),
    },
  });
  const accessToken = jwt.sign(
    { sub: user.id, sessionId: session.id, type: "access" },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.ACCESS_TOKEN_EXPIRES_IN },
  );
  const access = await loadRoles(user.id);
  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      emailVerified: Boolean(user.emailVerifiedAt),
      ...access,
    },
  };
}
export async function refresh(refreshToken, metadata) {
  if (!refreshToken) throw new AppError("Refresh token is required", 401, "INVALID_REFRESH_TOKEN");
  const session = await prisma.session.findFirst({
    where: {
      refreshTokenHash: hashToken(refreshToken),
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { user: true },
  });
  if (!session || !session.user.isActive || session.user.deletedAt)
    throw new AppError("Refresh token is invalid or revoked", 401, "INVALID_REFRESH_TOKEN");
  const nextRefresh = opaqueToken(48);
  const nextSession = await prisma.$transaction(async (tx) => {
    await tx.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    return tx.session.create({
      data: {
        userId: session.userId,
        refreshTokenHash: hashToken(nextRefresh),
        userAgent: metadata.userAgent,
        ipAddress: metadata.ipAddress,
        expiresAt: new Date(Date.now() + expiresInMs(env.REFRESH_TOKEN_EXPIRES_IN)),
      },
    });
  });
  const accessToken = jwt.sign(
    { sub: session.userId, sessionId: nextSession.id, type: "access" },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.ACCESS_TOKEN_EXPIRES_IN },
  );
  return { accessToken, refreshToken: nextRefresh };
}
export async function logout(refreshToken) {
  if (refreshToken)
    await prisma.session.updateMany({
      where: { refreshTokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
}
export async function logoutAll(userId) {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
export async function verifyEmail(token) {
  const record = await prisma.authToken.findFirst({
    where: {
      tokenHash: hashToken(token),
      type: AuthTokenType.EMAIL_VERIFICATION,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  if (!record)
    throw new AppError(
      "Verification token is invalid or expired",
      400,
      "INVALID_VERIFICATION_TOKEN",
    );
  await prisma.$transaction([
    prisma.authToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } }),
  ]);
}
export async function requestPasswordReset(email) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return;
  const token = opaqueToken();
  await prisma.authToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      type: AuthTokenType.PASSWORD_RESET,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  await sendEmail(
    user.email,
    "Reset your EventHub password",
    `<p>Use this password reset token: <strong>${token}</strong></p>`,
  );
}
export async function resetPassword(token, password) {
  const record = await prisma.authToken.findFirst({
    where: {
      tokenHash: hashToken(token),
      type: AuthTokenType.PASSWORD_RESET,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  if (!record) throw new AppError("Reset token is invalid or expired", 400, "INVALID_RESET_TOKEN");
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction([
    prisma.authToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.session.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
}
//# sourceMappingURL=auth.service.js.map
