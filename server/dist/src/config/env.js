import "dotenv/config";
import { z } from "zod";
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z
    .string()
    .default("postgresql://eventhub:eventhub@localhost:5432/event_management?schema=public"),
  JWT_ACCESS_SECRET: z.string().min(32).default("development-access-secret-change-me"),
  JWT_REFRESH_SECRET: z.string().min(32).default("development-refresh-secret-change-me"),
  ACCESS_TOKEN_EXPIRES_IN: z.string().default("15m"),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default("30d"),
  PUBLIC_APP_URL: z.string().url().default("http://localhost:5173"),
  ADMIN_APP_URL: z.string().url().default("http://localhost:5174"),
  STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
  STORAGE_BUCKET: z.string().default("event-platform"),
  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_REGION: z.string().default("auto"),
  STORAGE_ACCESS_KEY: z.string().optional(),
  STORAGE_SECRET_KEY: z.string().optional(),
  EMAIL_PROVIDER: z.string().default("console"),
  EMAIL_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("no-reply@example.com"),
  PROOF_VERIFICATION_PROVIDER: z.string().default("none"),
  PROOF_VERIFICATION_API_KEY: z.string().optional(),
  MAX_IMAGE_BYTES: z.coerce.number().default(10 * 1024 * 1024),
  MAX_DOCUMENT_BYTES: z.coerce.number().default(15 * 1024 * 1024),
});
const parsed = schema.parse(process.env);
if (parsed.NODE_ENV === "production") {
  const required = [
    "DATABASE_URL",
    "JWT_ACCESS_SECRET",
    "JWT_REFRESH_SECRET",
    "PUBLIC_APP_URL",
    "ADMIN_APP_URL",
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
  }
  if (parsed.JWT_ACCESS_SECRET === parsed.JWT_REFRESH_SECRET) {
    throw new Error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different in production");
  }
}
export const env = parsed;
//# sourceMappingURL=env.js.map
