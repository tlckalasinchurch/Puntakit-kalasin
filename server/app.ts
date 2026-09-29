import express, { type ErrorRequestHandler } from "express";
import cookieParser from "cookie-parser";
import { sql } from "drizzle-orm";
import { clerkMiddleware } from "@clerk/express";
import { authRouter } from "./routes/auth.js";
import { activitiesRouter } from "./routes/activities.js";
import { followUpsRouter } from "./routes/followUps.js";
import { submissionsRouter } from "./routes/submissions.js";
import { membersRouter } from "./routes/members.js";
import { announcementsRouter } from "./routes/announcements.js";
import { eventsRouter } from "./routes/events.js";
import { ministriesRouter } from "./routes/ministries.js";
import { churchProfileRouter } from "./routes/churchProfile.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { reportsRouter } from "./routes/reports.js";
import { groupsRouter } from "./routes/groups.js";
import { attendanceRouter } from "./routes/attendance.js";
import { portalRouter } from "./routes/portal.js";
import { requestIdMiddleware } from "./middleware/requestId.js";
import { isClerkConfigured } from "./lib/clerkAuth.js";
import { AppError } from "./lib/errors.js";
import { getDb } from "./db/client.js";

export function createApp() {
  const app = express();

  app.use(requestIdMiddleware);
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  // Clerk session verification. Runs on every request so protected routes can
  // read `getAuth(req)`; it only attaches auth state and never rejects by
  // itself. Disabled entirely when CLERK_SECRET_KEY is absent (local tests,
  // legacy deployments) so the legacy JWT path keeps working unchanged.
  if (isClerkConfigured()) {
    app.use(clerkMiddleware());
  }

  // API Routes
  app.use("/api/auth", authRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/reports", reportsRouter);
  app.use("/api/members", membersRouter);
  app.use("/api/groups", groupsRouter);
  app.use("/api/activities", activitiesRouter);
  app.use("/api/follow-ups", followUpsRouter);
  app.use("/api/submissions", submissionsRouter);
  app.use("/api/attendance", attendanceRouter);
  app.use("/api/me", portalRouter);
  app.use("/api/announcements", announcementsRouter);
  app.use("/api/events", eventsRouter);
  app.use("/api/ministries", ministriesRouter);
  app.use("/api/church-profile", churchProfileRouter);

  // Liveness Check
  app.get("/api/health", (_req, res) => {
    res.json({
      success: true,
      data: { status: "ok", timestamp: new Date().toISOString() },
    });
  });

  // Readiness Check (verifies DB connectivity)
  app.get("/api/ready", async (_req, res) => {
    try {
      const db = getDb();
      await db.execute(sql`SELECT 1`);
      res.json({
        success: true,
        data: {
          status: "ready",
          database: "connected",
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      res.status(503).json({
        success: false,
        error: {
          code: "DATABASE_UNAVAILABLE",
          message: "ไม่สามารถเชื่อมต่อกับฐานข้อมูลได้",
          details:
            process.env.NODE_ENV !== "production" ? [String(err)] : undefined,
        },
      });
    }
  });

  // 404 Handler for undefined API routes
  app.all("/api/*", (req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: `ไม่พบ Endpoint: ${req.method} ${req.path}`,
      },
    });
  });

  // Centralized Standard Error Handler
  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({
        success: false,
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      });
      return;
    }

    // Unexpected internal server error
    console.error("Unhandled Exception:", err);
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message:
          "เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้งหรือติดต่อผู้ดูแล",
        details:
          process.env.NODE_ENV !== "production"
            ? [{ message: String(err) }]
            : undefined,
      },
    });
  };
  app.use(errorHandler);

  return app;
}
