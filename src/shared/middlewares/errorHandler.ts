import type { ErrorRequestHandler } from 'express'
import type { Logger } from 'pino'

import { env } from '../../config/env.js'
import { AppError } from '../errors/AppError.js'
import { InternalError } from '../errors/HttpErrors.js'

interface ErrorBody {
  error: {
    code: string
    message: string
    requestId: string
    details?: unknown
  }
}

export const createErrorHandler = (logger: Logger): ErrorRequestHandler => {
  return (error: unknown, request, response, _next) => {
    void _next

    const requestId = request.requestId ?? 'unknown'

    if (error instanceof AppError && error.isOperational) {
      const body: ErrorBody = {
        error: {
          code: error.code,
          message: error.message,
          requestId,
          ...(error.details === undefined ? {} : { details: error.details }),
        },
      }

      response.status(error.statusCode).json(body)

      return
    }

    logger.error(
      {
        err: error,
        requestId,
        method: request.method,
        url: request.originalUrl,
      },
      'Unhandled application error',
    )

    const errorMessage =
      env.NODE_ENV !== 'production' && error instanceof Error
        ? error.message
        : 'An unexpected error occurred'

    const internalError = new InternalError(errorMessage)

    response.status(internalError.statusCode).json({
      error: {
        code: internalError.code,
        message: internalError.message,
        requestId,
      },
    } satisfies ErrorBody)
  }
}
