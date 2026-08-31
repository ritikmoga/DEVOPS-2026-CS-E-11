import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AppError } from "../utils/http.js";
export const notFound = (_req, _res, next) =>
  next(new AppError("Route not found", 404, "NOT_FOUND"));
export const errorHandler = (error, req, res, _next) => {
  if (error instanceof ZodError)
    return res.status(422).json({
      success: false,
      message: "Validation failed",
      code: "VALIDATION_ERROR",
      errors: error.issues,
    });
  if (error instanceof AppError)
    return res
      .status(error.statusCode)
      .json({ success: false, message: error.message, code: error.code, errors: error.details });
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002")
      return res.status(409).json({
        success: false,
        message: "A record with these values already exists",
        code: "DUPLICATE_RECORD",
        errors: error.meta?.target ?? [],
      });
    if (error.code === "P2025")
      return res
        .status(404)
        .json({ success: false, message: "Record not found", code: "NOT_FOUND", errors: [] });
  }
  req.log?.error?.(error);
  return res.status(500).json({
    success: false,
    message: "An unexpected server error occurred",
    code: "INTERNAL_ERROR",
    errors: [],
  });
};
//# sourceMappingURL=error.js.map
