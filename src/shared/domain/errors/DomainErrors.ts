export abstract class DomainError extends Error {
  public abstract readonly code: string

  protected constructor(message: string) {
    super(message)
    this.name = this.constructor.name
  }
}

export class UserAlreadyExistsError extends DomainError {
  public readonly code = 'USER_ALREADY_EXISTS'
  public constructor(email: string) {
    super(`User with email ${email} already exists`)
  }
}

export class InvalidCredentialsError extends DomainError {
  public readonly code = 'INVALID_CREDENTIALS'
  public constructor() {
    super('Invalid email or password')
  }
}

export class SessionExpiredError extends DomainError {
  public readonly code = 'SESSION_EXPIRED'
  public constructor() {
    super('Your session has expired')
  }
}

export class SecurityBreachError extends DomainError {
  public readonly code = 'SECURITY_BREACH'
  public constructor(reason: string) {
    super(`Security incident detected: ${reason}`)
  }
}
