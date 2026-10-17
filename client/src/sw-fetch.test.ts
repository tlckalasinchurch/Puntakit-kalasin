import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

/**
 * Runs the real client/public/sw.js against a fake FetchEvent.
 *
 * The bug this guards: `event.preloadResponse` is always a Promise, and it
 * resolves to `undefined` for every request that is not a preloaded navigation.
 * The worker used it as a truthy flag, so manifest, icons, images (and any
 * navigation without preload) were answered with `undefined` and failed. A source
 * regex cannot prove that; running the handler can.
 */

const SW_SOURCE = readFileSync(path.resolve(import.meta.dirname, "..", "public", "sw.js"), "utf8");

type FetchHandler = (event: unknown) => void;

function loadWorker(opts: { fetchImpl: (req: unknown) => Promise<Response>; cached?: Record<string, Response> }) {
  const handlers: Record<string, FetchHandler> = {};
  const put = vi.fn();
  const cachedBody = opts.cached ?? {};
  const caches = {
    open: async () => ({ put, addAll: async () => undefined }),
    match: async (req: unknown) => {
      const key = typeof req === "string" ? req : (req as { url: string }).url;
      const hit = cachedBody[key] ?? cachedBody[new URL(key, "http://localhost").pathname];
      return hit ? hit.clone() : undefined;
    },
    keys: async () => [],
    delete: async () => true,
  };
  const fetchSpy = vi.fn(opts.fetchImpl);
  const sandbox = {
    self: {
      addEventListener: (type: string, handler: FetchHandler) => {
        handlers[type] = handler;
      },
      skipWaiting: () => undefined,
      clients: { claim: async () => undefined },
      registration: { showNotification: async () => undefined },
    },
    caches,
    fetch: fetchSpy,
    Response,
    URL,
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(SW_SOURCE, sandbox);
  return { fetchHandler: handlers.fetch, fetchSpy, put };
}

/** Dispatches a GET and returns what the worker passed to respondWith (awaited). */
async function dispatch(
  fetchHandler: FetchHandler,
  url: string,
  preloadResponse: Promise<Response | undefined> | undefined | "absent"
): Promise<Response | undefined> {
  let responded: Promise<Response | undefined> | undefined;
  const event: Record<string, unknown> = {
    request: { url, method: "GET" },
    respondWith: (p: Promise<Response | undefined>) => {
      responded = p;
    },
  };
  if (preloadResponse !== "absent") event.preloadResponse = preloadResponse;
  fetchHandler(event);
  expect(responded, "the worker must call respondWith for this request").toBeDefined();
  return responded;
}

const ok = (body: string) => new Response(body, { status: 200 });
const text = async (r: Response | undefined) => (r ? r.text() : "<<undefined>>");

describe("service worker fetch handler", () => {
  it("answers a non-navigation request (manifest, icons, images) with the network, not with an undefined preload", async () => {
    const { fetchHandler, fetchSpy } = loadWorker({ fetchImpl: async () => ok("manifest-from-network") });
    // preloadResponse is a Promise that resolves to undefined for anything but a preloaded navigation
    for (const asset of ["/manifest.json", "/icon-192.png", "/church-emblem.png"]) {
      const res = await dispatch(fetchHandler, `http://localhost${asset}`, Promise.resolve(undefined));
      expect(await text(res)).toBe("manifest-from-network");
    }
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("uses the preloaded navigation response when there is one, without a second request", async () => {
    const { fetchHandler, fetchSpy } = loadWorker({ fetchImpl: async () => ok("from-fetch") });
    const res = await dispatch(fetchHandler, "http://localhost/app", Promise.resolve(ok("from-preload")));
    expect(await text(res)).toBe("from-preload");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("retries with a real fetch when the preload rejects (connection reset, 5xx, timeout)", async () => {
    const { fetchHandler, fetchSpy } = loadWorker({ fetchImpl: async () => ok("from-fetch") });
    const res = await dispatch(fetchHandler, "http://localhost/app", Promise.reject(new Error("preload failed")));
    expect(await text(res)).toBe("from-fetch");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("works where navigation preload does not exist at all (no preloadResponse property)", async () => {
    const { fetchHandler, fetchSpy } = loadWorker({ fetchImpl: async () => ok("from-fetch") });
    const res = await dispatch(fetchHandler, "http://localhost/login", "absent");
    expect(await text(res)).toBe("from-fetch");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("caches a 200 answer so the page is available offline later", async () => {
    const { fetchHandler, put } = loadWorker({ fetchImpl: async () => ok("shell") });
    await dispatch(fetchHandler, "http://localhost/app/group", Promise.resolve(undefined));
    await new Promise((r) => setTimeout(r, 0));
    expect(put).toHaveBeenCalledTimes(1);
  });

  it("offline: serves a cached page, else the cached shell, else an explicit 503 page — never undefined", async () => {
    const offline = async () => {
      throw new TypeError("Failed to fetch");
    };
    const visited = loadWorker({ fetchImpl: offline, cached: { "/visited": ok("visited-page"), "/": ok("shell") } });
    expect(await text(await dispatch(visited.fetchHandler, "http://localhost/visited", Promise.resolve(undefined)))).toBe("visited-page");
    expect(await text(await dispatch(visited.fetchHandler, "http://localhost/other", Promise.resolve(undefined)))).toBe("shell");

    const emptyCache = loadWorker({ fetchImpl: offline });
    const res = await dispatch(emptyCache.fetchHandler, "http://localhost/other", Promise.resolve(undefined));
    expect(res).toBeInstanceOf(Response);
    expect(res!.status).toBe(503);
  });

  it("offline: /api answers with the 503 OFFLINE JSON", async () => {
    const { fetchHandler } = loadWorker({
      fetchImpl: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    const res = await dispatch(fetchHandler, "http://localhost/api/members", Promise.resolve(undefined));
    expect(res!.status).toBe(503);
    expect(((await res!.json()) as { error: { code: string } }).error.code).toBe("OFFLINE");
  });
});
