import { AppError } from './AppError.js'
export { ValidationError, type ValidationIssue } from './ValidationError.js'

export class UnauthorizedError extends AppError {
  public constructor(message = 'Unauthorized') {
    super({
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message,
    })
  }
}

export class ForbiddenError extends AppError {
  public constructor(message = 'Forbidden') {
    super({
      statusCode: 403,
      code: 'FORBIDDEN',
      message,
    })
  }
}

export class NotFoundError extends AppError {
  public constructor(message = 'Resource not found') {
    super({
      statusCode: 404,
      code: 'NOT_FOUND',
      message,
    })
  }
}

export class ConflictError extends AppError {
  public constructor(message = 'Resource conflict') {
    super({
      statusCode: 409,
      code: 'CONFLICT',
      message,
    })
  }
}

export class TooManyRequestsError extends AppError {
  public constructor(message = 'Too many requests') {
    super({
      statusCode: 429,
      code: 'RATE_LIMIT_EXCEEDED',
      message,
    })
  }
}

export class InternalError extends AppError {
  public constructor(message = 'Internal server error', isOperational = false) {
    super({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message,
      isOperational,
    })
  }
}
