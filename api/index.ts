import type { Request, Response } from "express";
import { createApp } from "../server/app.js";
import { bootstrapDatabase } from "../server/db/bootstrap.js";

// Vercel Serverless Function entrypoint: handles every /api/* request via
// vercel.json's rewrite and hands it to the shared Express app (same routes
// used by server/index.ts for local dev / self-hosted `pnpm start`). No
// static file serving here — the client build is served separately by
// Vercel's static output.
//
// Named api/index.ts (not the api/[...path].ts catch-all convention)
// because Vercel's zero-config catch-all bracket routing only generated a
// single-segment route (matches /api/health, not /api/auth/me) for this
// project — the explicit rewrite below is the reliable way to route every
// /api/* request to one Express app regardless of path depth.

const app = createApp();

// Run the database bootstrap (schema verification + migrations) once per
// lambda instance before serving traffic. With DB_AUTO_MIGRATE unset this
// only verifies; remote drivers (neon/postgres) migrate only when
// DB_AUTO_MIGRATE=true, matching server/index.ts behaviour on self-hosted
// deployments. Failures return the standard 503 contract instead of crashing
// the function, and are retried on the next invocation.
let bootstrapPromise: Promise<unknown> | null = null;

function ensureBootstrap(): Promise<unknown> {
  if (!bootstrapPromise) {
    bootstrapPromise = bootstrapDatabase().catch((err: unknown) => {
      bootstrapPromise = null; // allow a retry on the next cold start
      throw err;
    });
  }
  return bootstrapPromise;
}

export default async function handler(req: Request, res: Response): Promise<void> {
  // /api/health is a pure liveness probe (process is up) and must not depend
  // on the database. Kick the bootstrap off in the background so migrations
  // still run on cold start, but never gate this route on it. Use the pathname
  // (not raw url) because vercel.json's rewrite appends ?path=... to requests.
  const { pathname } = new URL(req.url ?? "/", "http://localhost");
  if (pathname === "/api/health") {
    void ensureBootstrap().catch((err: unknown) => {
      console.error("[api] database bootstrap failed:", err);
    });
    app(req, res);
    return;
  }

  try {
    await ensureBootstrap();
  } catch (err) {
    console.error("[api] database bootstrap failed:", err);
    res.status(503).json({
      success: false,
      error: {
        code: "DATABASE_UNAVAILABLE",
        message: "ไม่สามารถเชื่อมต่อกับฐานข้อมูลได้",
        details: process.env.NODE_ENV !== "production" ? [String(err)] : undefined,
      },
    });
    return;
  }

  app(req, res);
}
