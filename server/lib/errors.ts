export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
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
