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

  constructor(message: string, status: number, code?: string, details?: Array<{ field?: string; message: string }>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function requestRaw<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  const body = (await res.json().catch(() => null)) as ApiResponse<T> | null;

  if (!res.ok || !body?.success) {
    let message = "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";
    let code: string | undefined;
    let details: Array<{ field?: string; message: string }> | undefined;

    if (body?.error) {
      if (typeof body.error === "string") {
        message = body.error;
      } else {
        message = body.error.message || message;
        code = body.error.code;
        details = body.error.details;
      }
    }

    throw new ApiError(message, res.status, code, details);
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
