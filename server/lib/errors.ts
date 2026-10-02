export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  // Authentication succeeded but the account cannot be used. These are split
  // out from FORBIDDEN because the browser has to tell them apart to show the
  // right next step: a suspended account needs an administrator, while a link
  // conflict needs a one-off repair (see `pnpm db:relink-clerk`). A bare 403
  // cannot carry that distinction, and guessing produced a redirect loop.
  | "ACCOUNT_SUSPENDED"
  | "ACCOUNT_LINK_CONFLICT"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMIT_EXCEEDED"
  | "BAD_REQUEST"
  | "INTERNAL_SERVER_ERROR";

export interface ErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

export class AppError extends Error {
  statusCode: number;
  code: ErrorCode;
  details?: ErrorDetail[];

  constructor(message: string, statusCode: number = 400, code: ErrorCode = "BAD_REQUEST", details?: ErrorDetail[]) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string = "ข้อมูลไม่ถูกต้อง", details?: ErrorDetail[]) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "กรุณาเข้าสู่ระบบ") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "คุณไม่มีสิทธิ์ดำเนินการนี้") {
    super(message, 403, "FORBIDDEN");
  }
}

/** The identity authenticated, but the local account is suspended. */
export class AccountSuspendedError extends AppError {
  constructor(message: string = "บัญชีผู้ใช้งานของคุณถูกระงับการใช้งานชั่วคราว กรุณาติดต่อผู้ดูแลระบบ") {
    super(message, 403, "ACCOUNT_SUSPENDED");
  }
}

/**
 * The email already belongs to a *different* Clerk user id. This is a
 * permanent, data-level condition (typically the account signed in through a
 * previous Clerk instance), not something a retry can fix, so it must not look
 * like a generic permission failure.
 */
export class AccountLinkConflictError extends AppError {
  constructor(message: string = "อีเมลนี้ถูกเชื่อมไว้กับบัญชีอื่นแล้ว กรุณาติดต่อผู้ดูแลระบบเพื่อแก้ไข") {
    super(message, 409, "ACCOUNT_LINK_CONFLICT");
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "ไม่พบข้อมูลที่ต้องการ") {
    super(message, 404, "NOT_FOUND");
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: ErrorDetail[]) {
    super(message, 409, "CONFLICT", details);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = "มีการร้องขอมากเกินไป กรุณารอสักครู่แล้วลองใหม่") {
    super(message, 429, "RATE_LIMIT_EXCEEDED");
  }
}
