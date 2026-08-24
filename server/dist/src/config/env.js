import "dotenv/config";
import { z } from "zod";
const schema = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().default(5000),
    DATABASE_URL: z.string().default("mongodb://localhost:27018/event_management?replicaSet=rs0"),
    JWT_ACCESS_SECRET: z.string().min(16).default("development-access-secret-change-me"),
    JWT_REFRESH_SECRET: z.string().min(16).default("development-refresh-secret-change-me"),
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
export const env = schema.parse(process.env);
//# sourceMappingURL=env.js.map