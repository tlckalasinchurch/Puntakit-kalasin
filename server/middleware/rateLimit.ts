import type { NextFunction, Request, Response } from "express";
import { RateLimitError } from "../lib/errors.js";

interface RateLimitStore {
  count: number;
  resetTime: number;
}

export function createRateLimiter(options: { windowMs: number; max: number; message?: string }) {
  const store = new Map<string, RateLimitStore>();

  // Periodically clean up expired entries every 5 minutes
  setInterval(() => {
    const now = Date.now();
    store.forEach((record, key) => {
      if (now > record.resetTime) {
        store.delete(key);
      }
    });
  }, 5 * 60 * 1000).unref();

  return (req: Request, _res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const key = `${req.baseUrl || ""}${req.path}:${ip}`;
    const now = Date.now();

    const record = store.get(key);
    if (!record || now > record.resetTime) {
      store.set(key, { count: 1, resetTime: now + options.windowMs });
      return next();
    }

    record.count += 1;
    if (record.count > options.max) {
      return next(new RateLimitError(options.message || "มีการพยายามเข้าถึงบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง"));
    }

    next();
  };
}

// 10 login attempts per 15 minutes per IP
export const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "คุณเข้าสู่ระบบไม่สำเร็จหลายครั้ง กรุณารอ 15 นาทีแล้วลองใหม่อีกครั้ง",
});
