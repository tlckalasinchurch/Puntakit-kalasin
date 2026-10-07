import { Router, type Request, type Response } from "express";
import { Webhook } from "svix";
import {
  provisionClerkUser,
  suspendClerkUser,
} from "../lib/clerkAuth.js";

const router = Router();

type ClerkUserEvent = {
  type: "user.created" | "user.updated" | "user.deleted" | string;
  data: {
    id?: string;
    first_name?: string | null;
    last_name?: string | null;
    primary_email_address_id?: string | null;
    email_addresses?: Array<{ id: string; email_address: string }>;
  };
};

function headerValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function getUserDetails(data: ClerkUserEvent["data"]) {
  const email =
    data.email_addresses?.find(
      item => item.id === data.primary_email_address_id
    )?.email_address ?? data.email_addresses?.[0]?.email_address ?? null;
  const name = [data.first_name, data.last_name]
    .filter(Boolean)
    .join(" ")
    .trim() || null;
  return { id: data.id ?? "", email, name };
}

/**
 * Clerk sends Svix-signed events to this endpoint. Keep this route before the
 * global JSON parser so the verifier receives the exact raw request body.
 */
router.post("/clerk", async (req: Request, res: Response) => {
  const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!secret) {
    res.status(503).json({
      success: false,
      error: {
        code: "CLERK_WEBHOOK_NOT_CONFIGURED",
        message: "Clerk webhook signing secret is not configured",
      },
    });
    return;
  }

  const svixHeaders = {
    "svix-id": headerValue(req.header("svix-id") ?? undefined),
    "svix-timestamp": headerValue(req.header("svix-timestamp") ?? undefined),
    "svix-signature": headerValue(req.header("svix-signature") ?? undefined),
  };

  try {
    const payload = new Webhook(secret).verify(
      Buffer.isBuffer(req.body) ? req.body.toString("utf8") : req.body,
      svixHeaders
    ) as unknown as ClerkUserEvent;

    if (!payload?.type || !payload.data) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_CLERK_WEBHOOK", message: "Invalid webhook payload" },
      });
      return;
    }

    if (payload.type === "user.deleted") {
      if (!payload.data.id) {
        res.status(400).json({
          success: false,
          error: { code: "INVALID_CLERK_WEBHOOK", message: "Deleted user has no id" },
        });
        return;
      }
      await suspendClerkUser(payload.data.id);
    } else if (payload.type === "user.created" || payload.type === "user.updated") {
      const user = getUserDetails(payload.data);
      if (!user.id) {
        res.status(400).json({
          success: false,
          error: { code: "INVALID_CLERK_WEBHOOK", message: "User event has no id" },
        });
        return;
      }
      await provisionClerkUser(user, { logger: console });
    }

    res.status(200).json({ success: true, data: { received: true } });
  } catch (error) {
    console.error("Clerk webhook verification or sync failed:", error);
    res.status(400).json({
      success: false,
      error: {
        code: "INVALID_CLERK_WEBHOOK",
        message: "Invalid Clerk webhook signature or payload",
      },
    });
  }
});

export const clerkWebhookRouter = router;
