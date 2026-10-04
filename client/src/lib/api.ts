export interface ApiErrorPayload {
  code?: string;
  message: string;
  details?: Array<{ field?: string; message: string }>;
}

export interface ApiMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  meta?: ApiMeta;
  error?: string | ApiErrorPayload;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: Array<{ field?: string; message: string }>;
  /**
   * The message the server actually sent, kept for the "รายละเอียดทางเทคนิค"
   * disclosure. `message` is the friendly sentence the user sees.
   */
  serverMessage?: string;

  constructor(message: string, status: number, code?: string, details?: Array<{ field?: string; message: string }>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * A short, plain-Thai sentence for the user, derived from the response status.
 *
 * The server already sends Thai messages for the errors it models explicitly
 * (`server/lib/errors.ts`, the Zod schemas in `shared/validation.ts`). This
 * covers the paths it cannot: a proxy or CDN returning an HTML error page, a
 * dropped connection, an expired session, and any message that is actually an
 * English exception string. The technical text is never thrown away — it stays
 * on `ApiError.serverMessage` for `ErrorState`'s disclosure.
 */
export function friendlyMessageFor(status: number, code?: string): string {
  switch (code) {
    case "RATE_LIMIT_EXCEEDED":
      return "มีการใช้งานถี่เกินไป กรุณารอสักครู่แล้วลองอีกครั้ง";
    case "VALIDATION_ERROR":
      return "ข้อมูลที่กรอกยังไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง";
    case "NOT_FOUND":
      return "ไม่พบข้อมูลที่ต้องการ อาจถูกลบไปแล้ว";
    case "CONFLICT":
      return "ข้อมูลนี้ซ้ำกับที่มีอยู่แล้ว";
    case "FORBIDDEN":
      return "คุณไม่มีสิทธิ์ดำเนินการนี้";
    case "ACCOUNT_SUSPENDED":
      return "บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ";
    case "ACCOUNT_LINK_CONFLICT":
      return "อีเมลนี้ถูกเชื่อมไว้กับบัญชีอื่นแล้ว กรุณาติดต่อผู้ดูแลระบบ";
    case "UNAUTHORIZED":
      return "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง";
    case "DATABASE_UNAVAILABLE":
      return "ระบบฐานข้อมูลยังไม่พร้อมใช้งาน กรุณาลองอีกครั้งในอีกสักครู่";
    default:
      break;
  }
  if (status === 401) return "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง";
  if (status === 403) return "คุณไม่มีสิทธิ์ดำเนินการนี้";
  if (status === 404) return "ไม่พบข้อมูลที่ต้องการ";
  if (status === 429) return "มีการใช้งานถี่เกินไป กรุณารอสักครู่แล้วลองอีกครั้ง";
  if (status >= 500) return "ระบบขัดข้องชั่วคราว กรุณาลองอีกครั้ง";
  return "ดำเนินการไม่สำเร็จ กรุณาลองอีกครั้ง";
}

/** Readable text, or undefined when the string is clearly not user-facing. */
function usableServerMessage(message: string | undefined): string | undefined {
  if (!message) return undefined;
  const trimmed = message.trim();
  if (trimmed.length === 0 || trimmed.length > 300) return undefined;
  // An HTML error page, a stack frame, or a bare exception name.
  if (/[<>]/.test(trimmed)) return undefined;
  if (/^(Error|TypeError|ZodError|SyntaxError)\b/.test(trimmed)) return undefined;
  if (/\bat\s+[\w.]+\s*\(/.test(trimmed)) return undefined;
  return trimmed;
}

/** Fired when any API call except the profile sync answers 401. */
export const UNAUTHORIZED_EVENT = "puntakit:unauthorized";
let lastUnauthorizedAt = 0;

function announceUnauthorized(path: string) {
  if (typeof window === "undefined" || path.startsWith("/api/auth/me")) return;
  const now = Date.now();
  // One event per 5 s: a page that fires 6 requests must not trigger 6 re-syncs.
  if (now - lastUnauthorizedAt < 5000) return;
  lastUnauthorizedAt = now;
  window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
}

async function requestRaw<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(
      "เชื่อมต่อกับระบบไม่สำเร็จ กรุณาตรวจสอบสัญญาณอินเทอร์เน็ตแล้วลองอีกครั้ง",
      0,
      "NETWORK_ERROR"
    );
  }

  const body = (await res.json().catch(() => null)) as ApiResponse<T> | null;

  if (!res.ok || !body?.success) {
    let serverMessage: string | undefined;
    let code: string | undefined;
    let details: Array<{ field?: string; message: string }> | undefined;

    if (body?.error) {
      if (typeof body.error === "string") {
        serverMessage = body.error;
      } else {
        serverMessage = body.error.message;
        code = body.error.code;
        details = body.error.details;
      }
    }

    const usable = usableServerMessage(serverMessage);
    // A modelled validation error carries per-field detail the form needs to
    // show next to the control, so its field messages survive verbatim.
    const message =
      code === "VALIDATION_ERROR" && usable
        ? usable
        : friendlyMessageFor(res.status, code);

    if (res.status === 401) announceUnauthorized(path);

    const error = new ApiError(message, res.status, code, details);
    error.serverMessage = usable;
    throw error;
  }

  return body;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await requestRaw<T>(path, init);
  return res.data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  getWithMeta: <T>(path: string) => requestRaw<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "POST", body: data !== undefined ? JSON.stringify(data) : undefined }),
  put: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PUT", body: data !== undefined ? JSON.stringify(data) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

/**
 * Form-level error text. The "check the data" hint only fits a rejected input
 * (400/422); on a server fault or a lost connection it would mislead.
 */
export function withRecheckHint(message: string, err: unknown): string {
  const status = err instanceof ApiError ? err.status : 0;
  return status === 400 || status === 422 ? `${message} กรุณาตรวจสอบข้อมูลแล้วลองอีกครั้ง` : message;
}
