import { AppError } from './AppError.js'

export interface ValidationIssue {
  field: string
  message: string
}

export class ValidationError extends AppError<ValidationIssue[]> {
  public constructor(
    details: ValidationIssue[],
    message = 'Validation failed',
  ) {
    super({
      statusCode: 422,
      code: 'VALIDATION_ERROR',
      message,
      details,
    })
  }
}
