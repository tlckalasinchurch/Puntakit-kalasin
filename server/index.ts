import express from "express";
import { createServer, type Server } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { createApp } from "./app.js";
import { bootstrapDatabase } from "./db/bootstrap.js";
import { closeDatabase } from "./db/client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Upper bound for the graceful shutdown sequence before forcing an exit. */
const SHUTDOWN_TIMEOUT_MS = 10_000;

async function startServer() {
  // Fail-fast: resolve the driver, validate the configuration and bootstrap the
  // local database before the HTTP server accepts any traffic.
  await bootstrapDatabase();

  const app = createApp();
  const server = createServer(app);

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || process.env.API_PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });

  registerShutdownHandlers(server);
}

/** Stops accepting connections, drains requests and closes the database. */
function registerShutdownHandlers(server: Server) {
  let shuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`[server] ${signal} received — shutting down gracefully...`);

    const forceExit = setTimeout(() => {
      console.error(`[server] graceful shutdown timed out after ${SHUTDOWN_TIMEOUT_MS}ms — forcing exit`);
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();

    try {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await closeDatabase();
    } catch (error) {
      console.error("[server] error while shutting down:", error);
      process.exitCode = 1;
    } finally {
      clearTimeout(forceExit);
    }

    console.log("[server] shutdown complete");
    process.exit(process.exitCode ?? 0);
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

startServer().catch(async (error) => {
  console.error("[server] failed to start:", error);
  await closeDatabase();
  process.exit(1);
});
