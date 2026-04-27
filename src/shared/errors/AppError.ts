export interface AppErrorOptions<TDetails> {
  statusCode: number
  code: string
  message: string
  isOperational?: boolean
  details?: TDetails
}

export class AppError<TDetails = unknown> extends Error {
  public readonly statusCode: number

  public readonly code: string

  public readonly isOperational: boolean

  public readonly details: TDetails | undefined

  public constructor(options: AppErrorOptions<TDetails>) {
    super(options.message)

    this.name = new.target.name
    this.statusCode = options.statusCode
    this.code = options.code
    this.isOperational = options.isOperational ?? true
    this.details = options.details

    Object.setPrototypeOf(this, new.target.prototype)
  }
}
