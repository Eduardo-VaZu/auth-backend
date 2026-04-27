import { randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'

import type { RequestHandler } from 'express'
import type { Logger } from 'pino'

export const createRequestLogger = (logger: Logger): RequestHandler => {
  return (request, response, next) => {
    const requestId = randomUUID()
    const startedAt = performance.now()

    request.requestId = requestId

    logger.info(
      {
        requestId,
        method: request.method,
        url: request.originalUrl,
      },
      'Request started',
    )

    response.on('finish', () => {
      logger.info(
        {
          requestId,
          method: request.method,
          url: request.originalUrl,
          statusCode: response.statusCode,
          durationMs: Number((performance.now() - startedAt).toFixed(2)),
        },
        'Request completed',
      )
    })

    next()
  }
}
