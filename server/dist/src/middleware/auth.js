import jwt from "jsonwebtoken";
import { prisma } from "../prisma.js";
import { env } from "../config/env.js";
import { AppError } from "../utils/http.js";
export const requireAuth = async (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer "))
      throw new AppError("Authentication required", 401, "UNAUTHENTICATED");
    const payload = jwt.verify(header.slice(7), env.JWT_ACCESS_SECRET);
    if (payload.type !== "access") throw new AppError("Invalid access token", 401, "INVALID_TOKEN");
    const user = await prisma.user.findFirst({
      where: { id: payload.sub, isActive: true, deletedAt: null },
      include: {
        roles: {
          include: { role: { include: { permissions: { include: { permission: true } } } } },
        },
      },
    });
    if (!user)
      throw new AppError("User account is inactive or unavailable", 401, "UNAUTHENTICATED");
    req.user = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roles: user.roles.map((item) => item.role.name),
      permissions: [
        ...new Set(
          user.roles.flatMap((item) =>
            item.role.permissions.map((permission) => permission.permission.code),
          ),
        ),
      ],
    };
    next();
  } catch (error) {
    next(
      error instanceof jwt.JsonWebTokenError
        ? new AppError("Invalid or expired access token", 401, "INVALID_TOKEN")
        : error,
    );
  }
};
export function requirePermission(...permissions) {
  return (req, _res, next) => {
    if (!req.user) return next(new AppError("Authentication required", 401, "UNAUTHENTICATED"));
    const allowed = permissions.every((permission) => req.user.permissions.includes(permission));
    if (!allowed)
      return next(
        new AppError("You do not have permission to perform this action", 403, "FORBIDDEN"),
      );
    next();
  };
}
export const requireAnyRole =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user) return next(new AppError("Authentication required", 401, "UNAUTHENTICATED"));
    if (!roles.some((role) => req.user.roles.includes(role)))
      return next(new AppError("Role is not permitted", 403, "FORBIDDEN"));
    next();
  };
//# sourceMappingURL=auth.js.map
