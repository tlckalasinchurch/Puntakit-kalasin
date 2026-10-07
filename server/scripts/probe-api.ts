import { performance } from "node:perf_hooks";

type Probe = {
  method: "GET" | "POST";
  path: string;
  expected: number[];
  body?: string;
  headers?: Record<string, string>;
};

const baseUrl = (process.env.PROBE_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const probes: Probe[] = [
  { method: "GET", path: "/api/health", expected: [200] },
  { method: "GET", path: "/api/ready", expected: [200, 503] },
  { method: "GET", path: "/api/auth/me", expected: [200, 401, 503] },
  { method: "POST", path: "/api/webhooks/clerk", expected: [200, 400, 503], body: JSON.stringify({ type: "probe", data: {} }), headers: { "content-type": "application/json" } },
  { method: "GET", path: "/api/dashboard/summary", expected: [200, 401, 503] },
  { method: "GET", path: "/api/reports/summary", expected: [200, 401, 503] },
  { method: "GET", path: "/api/members", expected: [200, 401, 503] },
  { method: "GET", path: "/api/groups", expected: [200, 401, 503] },
  { method: "GET", path: "/api/attendance", expected: [200, 401, 503] },
  { method: "GET", path: "/api/events", expected: [200, 401, 503] },
  { method: "GET", path: "/api/announcements", expected: [200, 401, 503] },
  { method: "GET", path: "/api/ministries", expected: [200, 401, 503] },
  { method: "GET", path: "/api/church-profile", expected: [200, 401, 503] },
];

async function main() {
  console.log(`API probe: ${baseUrl}`);
  console.log("method\tpath\tstatus\tlatency\tresult");
  let failures = 0;

  for (const probe of probes) {
    const started = performance.now();
    try {
      const response = await fetch(`${baseUrl}${probe.path}`, {
        method: probe.method,
        headers: probe.headers,
        body: probe.body,
      });
      const latency = Math.round(performance.now() - started);
      const ok = probe.expected.includes(response.status);
      if (!ok) failures += 1;
      console.log(`${probe.method}\t${probe.path}\t${response.status}\t${latency}ms\t${ok ? "PASS" : "FAIL"}`);
    } catch (error) {
      failures += 1;
      const latency = Math.round(performance.now() - started);
      console.log(`${probe.method}\t${probe.path}\tERR\t${latency}ms\tFAIL ${String(error)}`);
    }
  }

  if (failures > 0) {
    console.error(`Probe failed: ${failures} endpoint(s)`);
    process.exitCode = 1;
  } else {
    console.log(`Probe passed: ${probes.length} endpoint(s)`);
  }
}

void main();
