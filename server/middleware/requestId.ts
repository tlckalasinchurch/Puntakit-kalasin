import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";

declare global {
  namespace Express {
    interface Request {
      id: string;
      startTime: number;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const reqId = (req.headers["x-request-id"] as string) || randomUUID();
  req.id = reqId;
  req.startTime = Date.now();
  res.setHeader("X-Request-Id", reqId);

  res.on("finish", () => {
    const durationMs = Date.now() - req.startTime;
    // Structured log for monitoring
    if (process.env.NODE_ENV !== "test") {
      const logEntry = {
        requestId: req.id,
        method: req.method,
        url: req.originalUrl || req.url,
        status: res.statusCode,
        durationMs,
        ip: req.ip || req.socket.remoteAddress,
        userAgent: req.headers["user-agent"],
      };
      if (res.statusCode >= 400) {
        console.warn(JSON.stringify({ level: "warn", ...logEntry }));
      } else {
        console.info(JSON.stringify({ level: "info", ...logEntry }));
      }
    }
  });

  next();
}
