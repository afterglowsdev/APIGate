export class GatewayError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'GatewayError'
  }
}

export class UnauthorizedError extends GatewayError {
  constructor(message = 'Unauthorized') {
    super('unauthorized', message, 401)
  }
}

export class ForbiddenError extends GatewayError {
  constructor(code: string, message: string) {
    super(code, message, 403)
  }
}

export class ClientDisabledError extends ForbiddenError {
  constructor(message = 'Client is disabled') {
    super('client_disabled', message)
  }
}

export class ProfileNotFoundError extends ForbiddenError {
  constructor(message = 'Profile not found') {
    super('profile_not_found', message)
  }
}

export class ProfileDisabledError extends ForbiddenError {
  constructor(message = 'Profile is disabled') {
    super('profile_disabled', message)
  }
}

export class ModelNotAllowedError extends ForbiddenError {
  constructor(message = 'Model not allowed for this client') {
    super('model_not_allowed', message)
  }
}

export class QuotaExceededError extends GatewayError {
  constructor(message = 'Quota exceeded') {
    super('quota_exceeded', message, 429)
  }
}

export class OutsideAllowedHoursError extends ForbiddenError {
  constructor(message = 'Client is outside allowed hours') {
    super('outside_allowed_hours', message)
  }
}

export class RateLimitError extends GatewayError {
  constructor(
    message = 'Too many requests',
    public retryAfter?: number,
  ) {
    super('rate_limited', message, 429)
  }
}

export class InvalidRequestError extends GatewayError {
  constructor(message: string) {
    super('invalid_request', message, 400)
  }
}

export class RequestTooLargeError extends GatewayError {
  constructor(message = 'Request body too large') {
    super('request_too_large', message, 413)
  }
}

export class UpstreamError extends GatewayError {
  constructor(message = 'Upstream service error') {
    super('upstream_error', message, 502)
  }
}

export class TimeoutError extends GatewayError {
  constructor(message = 'Upstream request timed out') {
    super('timeout', message, 504)
  }
}

export class InternalError extends GatewayError {
  constructor(message = 'Internal server error') {
    super('internal_error', message, 500)
  }
}
