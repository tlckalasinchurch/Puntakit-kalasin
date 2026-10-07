import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clerkWebhookRouter } from "./clerkWebhook.js";

vi.mock("../lib/clerkAuth.js", () => ({
  provisionClerkUser: vi.fn(),
  suspendClerkUser: vi.fn(),
}));

function createTestApp() {
  const app = express();
  app.use(express.raw({ type: "application/json" }));
  app.use("/api/webhooks", clerkWebhookRouter);
  return app;
}

describe("Clerk webhook security contract", () => {
  const originalSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  beforeEach(() => {
    delete process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  });
  afterEach(() => {
    if (originalSecret === undefined) delete process.env.CLERK_WEBHOOK_SIGNING_SECRET;
    else process.env.CLERK_WEBHOOK_SIGNING_SECRET = originalSecret;
  });

  it("rejects deliveries when the signing secret is not configured", async () => {
    const server = createTestApp().listen(0);
    try {
      const address = server.address();
      const response = await fetch(`http://127.0.0.1:${(address as { port: number }).port}/api/webhooks/clerk`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "user.created", data: { id: "u_1" } }),
      });
      expect(response.status).toBe(503);
      expect((await response.json()).error.code).toBe("CLERK_WEBHOOK_NOT_CONFIGURED");
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });

  it("rejects missing or invalid Svix signatures", async () => {
    process.env.CLERK_WEBHOOK_SIGNING_SECRET = "whsec_test_secret";
    const server = createTestApp().listen(0);
    try {
      const address = server.address();
      const response = await fetch(`http://127.0.0.1:${(address as { port: number }).port}/api/webhooks/clerk`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "svix-id": "msg_probe",
          "svix-timestamp": String(Math.floor(Date.now() / 1000)),
          "svix-signature": "v1,invalid",
        },
        body: JSON.stringify({ type: "user.created", data: { id: "u_1" } }),
      });
      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe("INVALID_CLERK_WEBHOOK");
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });
});
