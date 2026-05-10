/**
 * Unified error types for the LLM API Gateway
 * 网关统一错误类型
 *
 * Each error carries a machine-readable code, human-readable message, and HTTP status.
 * 每种错误包含 machine-readable code、人类可读 message 和 HTTP status
 */

export class GatewayError extends Error {
  constructor(
    public code: string,       // machine-readable error code (e.g. "unauthorized") / 机器可读错误码
    message: string,           // human-readable error message / 人类可读错误消息
    public status: number,     // HTTP status code / HTTP 状态码
    public details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'GatewayError'
  }
}

// 401 — Client token missing or invalid / 未认证：Token 缺失或无效
export class UnauthorizedError extends GatewayError {
  constructor(message = 'Unauthorized') {
    super('unauthorized', message, 401)
  }
}

// 403 — Authenticated but not permitted / 已认证但无权限
export class ForbiddenError extends GatewayError {
  constructor(code: string, message: string) {
    super(code, message, 403)
  }
}

// 403 — Client has been disabled / 客户端已禁用
export class ClientDisabledError extends ForbiddenError {
  constructor(message = 'Client is disabled') {
    super('client_disabled', message)
  }
}

// 403 — Profile does not exist / 模型档位不存在
export class ProfileNotFoundError extends ForbiddenError {
  constructor(message = 'Profile not found') {
    super('profile_not_found', message)
  }
}

// 403 — Profile is disabled / 模型档位已禁用
export class ProfileDisabledError extends ForbiddenError {
  constructor(message = 'Profile is disabled') {
    super('profile_disabled', message)
  }
}

// 403 — Client not allowed to use this profile / 客户端无权限使用该档位
export class ModelNotAllowedError extends ForbiddenError {
  constructor(message = 'Model not allowed for this client') {
    super('model_not_allowed', message)
  }
}

// 429 — Quota exhausted / 额度超限
export class QuotaExceededError extends GatewayError {
  constructor(message = 'Quota exceeded') {
    super('quota_exceeded', message, 429)
  }
}

// 403 — Request outside allowed time window / 不在允许的时间范围内
export class OutsideAllowedHoursError extends ForbiddenError {
  constructor(message = 'Client is outside allowed hours') {
    super('outside_allowed_hours', message)
  }
}

// 429 — Too many requests in current window / 请求频率超限
export class RateLimitError extends GatewayError {
  constructor(
    message = 'Too many requests',
    public retryAfter?: number, // suggested wait time in seconds / 建议重试等待秒数
  ) {
    super('rate_limited', message, 429)
  }
}

// 400 — Malformed request / 请求格式错误
export class InvalidRequestError extends GatewayError {
  constructor(message: string) {
    super('invalid_request', message, 400)
  }
}

// 413 — Request body exceeds size limit / 请求体过大
export class RequestTooLargeError extends GatewayError {
  constructor(message = 'Request body too large') {
    super('request_too_large', message, 413)
  }
}

// 502 — Upstream (New API) returned an error / 上游服务异常
export class UpstreamError extends GatewayError {
  constructor(message = 'Upstream service error') {
    super('upstream_error', message, 502)
  }
}

// 504 — Upstream request timed out / 上游请求超时
export class TimeoutError extends GatewayError {
  constructor(message = 'Upstream request timed out') {
    super('timeout', message, 504)
  }
}

// 500 — Unexpected internal error / 网关内部错误
export class InternalError extends GatewayError {
  constructor(message = 'Internal server error') {
    super('internal_error', message, 500)
  }
}
