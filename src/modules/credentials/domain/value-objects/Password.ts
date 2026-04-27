import { ValidationError } from '../../../../shared/errors/ValidationError.js'

const MIN_PASSWORD_LENGTH = 8

export class Password {
  public readonly value: string

  public constructor(value: string) {
    if (value.length < MIN_PASSWORD_LENGTH) {
      throw new ValidationError([
        {
          field: 'password',
          message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`,
        },
      ])
    }

    this.value = value
  }
}
