import type { RequestHandler } from 'express'

import type { ZodTypeAny } from 'zod'

import { ValidationError } from '../errors/ValidationError.js'

export const validateBody = <TSchema extends ZodTypeAny>(
  schema: TSchema,
): RequestHandler => {
  return (request, _response, next) => {
    const parsedBody = schema.safeParse(request.body)

    if (!parsedBody.success) {
      next(
        new ValidationError(
          parsedBody.error.issues.map((issue) => ({
            field: issue.path.join('.') || 'body',
            message: issue.message,
          })),
        ),
      )

      return
    }

    const sanitizedBody = parsedBody.data as unknown
    request.body = sanitizedBody
    next()
  }
}
