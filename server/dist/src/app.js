import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import { env } from "./config/env.js";
import { errorHandler, notFound } from "./middleware/error.js";
export const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: [env.PUBLIC_APP_URL, env.ADMIN_APP_URL], credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());
app.use(pinoHttp());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));
app.get("/health", (_req, res) => res.json({
    success: true,
    data: { status: "ok", service: "event-platform-api", timestamp: new Date().toISOString() },
}));
app.use("/api/v1", router);
app.use(notFound);
app.use(errorHandler);
//# sourceMappingURL=app.js.map