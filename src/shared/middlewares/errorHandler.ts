import type { ErrorRequestHandler } from 'express'
import type { Logger } from 'pino'

import { env } from '../../config/env.js'
import { AppError } from '../errors/AppError.js'
import {
  ConflictError,
  UnauthorizedError,
  InternalError,
} from '../errors/HttpErrors.js'
import {
  DomainError,
  UserAlreadyExistsError,
  InvalidCredentialsError,
  SecurityBreachError,
} from '../domain/errors/DomainErrors.js'

interface ErrorBody {
  error: {
    code: string
    message: string
    requestId: string
    details?: unknown
  }
}

const mapDomainToHttpError = (error: DomainError): AppError => {
  if (error instanceof UserAlreadyExistsError) {
    return new ConflictError(error.message)
  }
  if (error instanceof InvalidCredentialsError) {
    return new UnauthorizedError(error.message)
  }
  if (error instanceof SecurityBreachError) {
    return new UnauthorizedError(error.message)
  }

  return new InternalError(error.message)
}

export const createErrorHandler = (logger: Logger): ErrorRequestHandler => {
  return (error: unknown, request, response, _next) => {
    void _next

    const requestId = request.requestId ?? 'unknown'
    let finalError = error

    // Transformación de Error de Dominio a Error de Aplicación (HTTP)
    if (error instanceof DomainError) {
      finalError = mapDomainToHttpError(error)
    }

    if (finalError instanceof AppError && finalError.isOperational) {
      const body: ErrorBody = {
        error: {
          code: finalError.code,
          message: finalError.message,
          requestId,
          ...(finalError.details === undefined
            ? {}
            : { details: finalError.details }),
        },
      }

      response.status(finalError.statusCode).json(body)

      return
    }

    logger.error(
      {
        err: finalError,
        requestId,
        method: request.method,
        url: request.originalUrl,
      },
      'Unhandled application error',
    )

    const errorMessage =
      env.NODE_ENV !== 'production' && finalError instanceof Error
        ? finalError.message
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
