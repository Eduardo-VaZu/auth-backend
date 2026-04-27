import { ValidationError } from '../../../../shared/errors/ValidationError.js'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u

export class Email {
  public readonly value: string

  public constructor(value: string) {
    const normalizedValue = value.trim().toLowerCase()

    if (!EMAIL_PATTERN.test(normalizedValue)) {
      throw new ValidationError([
        {
          field: 'email',
          message: 'Invalid email address',
        },
      ])
    }

    this.value = normalizedValue
  }
}
