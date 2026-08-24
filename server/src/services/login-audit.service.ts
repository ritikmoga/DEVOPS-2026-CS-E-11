import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

export type PublicLoginAuditEvent = {
  email: string;
  success: boolean;
  userId?: string;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
};

const auditFile =
  process.env.LOGIN_AUDIT_FILE?.trim() ||
  path.resolve(process.cwd(), "logs", "public-login-audit.jsonl");

export async function recordPublicLogin(event: PublicLoginAuditEvent) {
  const record = {
    timestamp: new Date().toISOString(),
    site: "public",
    event: "login",
    email: event.email.trim().toLowerCase().slice(0, 320),
    success: event.success,
    ...(event.userId ? { userId: event.userId } : {}),
    ...(event.reason ? { reason: event.reason.slice(0, 80) } : {}),
    ...(event.ipAddress ? { ipAddress: event.ipAddress.slice(0, 100) } : {}),
    ...(event.userAgent ? { userAgent: event.userAgent.slice(0, 512) } : {}),
  };

  await mkdir(path.dirname(auditFile), { recursive: true });
  await appendFile(auditFile, `${JSON.stringify(record)}\n`, "utf8");
}
