// import express from "express";
// import cors from "cors";
// import cookieParser from "cookie-parser";
// import helmet from "helmet";
// import rateLimit from "express-rate-limit";
// import pinoHttp from "pino-http";
// import router from "./routes/index.js";
// import { env } from "./config/env.js";
// import { errorHandler, notFound } from "./middleware/error.js";
// export const app = express();
// app.disable("x-powered-by");
// app.use(helmet());
// app.use(cors({ origin: [env.PUBLIC_APP_URL, env.ADMIN_APP_URL], credentials: true }));
// app.use(express.json({ limit: "1mb" }));
// app.use(express.urlencoded({ extended: true, limit: "1mb" }));
// app.use(cookieParser());
// app.use(pinoHttp());
// app.use(
//   rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }),
// );
// app.get("/health", (_req, res) =>
//   res.json({
//     success: true,
//     data: { status: "ok", service: "event-platform-api", timestamp: new Date().toISOString() },
//   }),
// );
// app.use("/api/v1", router);
// app.use(notFound);
// app.use(errorHandler);
// //# sourceMappingURL=app.js.map




























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

/* -------------------------------------------------------
   Security
------------------------------------------------------- */

app.disable("x-powered-by");

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

/* -------------------------------------------------------
   CORS
------------------------------------------------------- */

const allowedOrigins = [
  env.PUBLIC_APP_URL,
  env.ADMIN_APP_URL,
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests without an Origin header
      // e.g. health checks, Postman, server-to-server requests
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origin not allowed by CORS"));
    },

    credentials: true,

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
  })
);

/* -------------------------------------------------------
   Request Parsing
------------------------------------------------------- */

app.use(
  express.json({
    limit: "1mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb",
  })
);

app.use(cookieParser());

/* -------------------------------------------------------
   Logging
------------------------------------------------------- */

app.use(
  pinoHttp({
    autoLogging: {
      ignore: (req) => req.url === "/health",
    },
  })
);

/* -------------------------------------------------------
   Rate Limiting
------------------------------------------------------- */

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  // Maximum 300 requests per IP per 15 minutes
  limit: 300,

  standardHeaders: true,
  legacyHeaders: false,

  message: {
    success: false,
    error: "Too many requests. Please try again later.",
  },
});

app.use("/api", apiLimiter);

/* -------------------------------------------------------
   Health Check
------------------------------------------------------- */

app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: "ok",
      service: "event-platform-api",
      timestamp: new Date().toISOString(),
    },
  });
});

/* -------------------------------------------------------
   API Routes
------------------------------------------------------- */

app.use("/api/v1", router);

/* -------------------------------------------------------
   404 Handler
------------------------------------------------------- */

app.use(notFound);

/* -------------------------------------------------------
   Global Error Handler
   IMPORTANT: Must remain the last middleware
------------------------------------------------------- */

app.use(errorHandler);
