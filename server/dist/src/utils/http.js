export class AppError extends Error {
  statusCode;
  code;
  details;
  constructor(message, statusCode = 400, code = "BAD_REQUEST", details = []) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}
export const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);
export function ok(res, data, message, status = 200) {
  return res.status(status).json({ success: true, ...(message ? { message } : {}), data });
}
export function created(res, data, message = "Created") {
  return ok(res, data, message, 201);
}
export function pagination(page, limit, total) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}
//# sourceMappingURL=http.js.map
