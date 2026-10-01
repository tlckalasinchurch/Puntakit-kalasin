import express, { type ErrorRequestHandler, type Request } from "express";
import { sql } from "drizzle-orm";
import { clerkMiddleware } from "@clerk/express";
import { authRouter } from "./routes/auth.js";
import { clerkWebhookRouter } from "./routes/clerkWebhook.js";
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
import { isDemoModeEnabled, isLegacyTestAuthEnabled } from "./middleware/auth.js";
import { isClerkConfigured, resolveClerkPublishableKey } from "./lib/clerkAuth.js";
import { AppError } from "./lib/errors.js";
import { getDb } from "./db/client.js";

export function createApp() {
  const app = express();

  // Do not advertise the framework on every response.
  app.disable("x-powered-by");
  // TLS terminates one hop in front of the app (Vercel's proxy, or a reverse
  // proxy when self-hosted). Without this, `req.ip` is the proxy's address for
  // every request — which would collapse any IP-keyed rate limit into one
  // shared bucket and write misleading client IPs into the audit log.
  app.set("trust proxy", 1);

  app.use(requestIdMiddleware);
  // Must run before express.json(): Svix verifies the exact raw request body.
  app.use(
    "/api/webhooks",
    express.raw({ type: "application/json", limit: "1mb" }),
    clerkWebhookRouter
  );
  app.use(express.json({ limit: "1mb" }));
  app.use((req, _res, next) => {
    const cookies: Record<string, string> = {};
    for (const pair of (req.headers.cookie ?? "").split(";")) {
      const separator = pair.indexOf("=");
      if (separator > 0) {
        cookies[pair.slice(0, separator).trim()] = decodeURIComponent(pair.slice(separator + 1).trim());
      }
    }
    (req as Request & { cookies?: Record<string, string> }).cookies = cookies;
    next();
  });

  // Liveness must remain available even when Clerk or the database is
  // misconfigured; readiness below is the dependency-aware health check.
  app.get("/api/health", (_req, res) => {
    res.json({
      success: true,
      data: { status: "ok", timestamp: new Date().toISOString() },
    });
  });

  // Clerk is the only authentication provider. The middleware attaches the
  // verified Clerk session to every request; protected routes enforce it.
  const isProduction = process.env.NODE_ENV === "production";

  // Fail fast on auth-mode flags that only make sense outside a deployment.
  // Silently ignoring them would hide a real misconfiguration instead of
  // surfacing it at start-up (the same policy `server/db/config.ts` applies to
  // PGlite): with the legacy test path active, a token signed with the test
  // secret satisfies `requireAuth` and, because `requireRole()` always lets
  // `super_admin` through, every gate in the app.
  if (isProduction && process.env.PUNTAKIT_TEST_AUTH === "1") {
    throw new Error(
      "PUNTAKIT_TEST_AUTH=1 is rejected when NODE_ENV=production. It enables the legacy cookie/JWT auth path, which must never be reachable from a deployment. Remove the variable."
    );
  }
  if (isProduction && process.env.PUNTAKIT_DEMO_MODE === "1") {
    throw new Error(
      "PUNTAKIT_DEMO_MODE=1 is rejected when NODE_ENV=production. Demo mode auto-provisions an admin account. Remove the variable."
    );
  }

  const isLegacyTestRuntime = isLegacyTestAuthEnabled();
  const isLocalDemoRuntime = isDemoModeEnabled();
  if (!isLegacyTestRuntime && !isLocalDemoRuntime) {
    if (!isClerkConfigured()) {
      throw new Error(
        "Clerk is not configured: CLERK_SECRET_KEY and a publishable key (CLERK_PUBLISHABLE_KEY or VITE_CLERK_PUBLISHABLE_KEY) are required in non-test environments."
      );
    }
    // Pass the key explicitly. Left to itself, `clerkMiddleware()` only looks
    // for CLERK_PUBLISHABLE_KEY in the environment — a name this project never
    // sets, because the browser build uses VITE_CLERK_PUBLISHABLE_KEY — and
    // every request behind the middleware then fails with a 500
    // "Publishable key is missing".
    app.use(clerkMiddleware({ publishableKey: resolveClerkPublishableKey() }));
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
