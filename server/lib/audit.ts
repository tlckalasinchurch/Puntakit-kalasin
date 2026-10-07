import type { Request } from "express";
import { getDb } from "../db/client.js";
import { auditLogs } from "../../shared/schema.js";

export interface LogAuditOptions {
  req?: Request;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown> | null;
}

export async function logAudit(options: LogAuditOptions): Promise<void> {
  try {
    const db = getDb();
    const userId = options.userId ?? options.req?.user?.id ?? null;
    const ipAddress = options.req ? options.req.ip || options.req.socket.remoteAddress || null : null;
    const userAgent = options.req ? (options.req.headers["user-agent"] as string) || null : null;

    await db.insert(auditLogs).values({
      userId,
      action: options.action,
      entityType: options.entityType,
      entityId: options.entityId ?? null,
      details: options.details ? JSON.stringify(options.details) : null,
      ipAddress,
      userAgent,
    });
  } catch (err) {
    // Audit logging should never crash the main request flow, but should log a warning
    console.warn("Failed to write audit log:", err);
  }
}
