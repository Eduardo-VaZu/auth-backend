export type OneTimeTokenType = 'password_reset' | 'email_verification'

export interface OneTimeTokenProps {
  id: string
  userId: string
  type: OneTimeTokenType
  tokenHash: string
  requestedByIp: string | null
  expiresAt: Date
  usedAt: Date | null
  createdAt: Date
}

export class OneTimeToken {
  public readonly id: string

  public readonly userId: string

  public readonly type: OneTimeTokenType

  public readonly tokenHash: string

  public readonly requestedByIp: string | null

  public readonly expiresAt: Date

  public readonly usedAt: Date | null

  public readonly createdAt: Date

  public constructor(props: OneTimeTokenProps) {
    this.id = props.id
    this.userId = props.userId
    this.type = props.type
    this.tokenHash = props.tokenHash
    this.requestedByIp = props.requestedByIp
    this.expiresAt = props.expiresAt
    this.usedAt = props.usedAt
    this.createdAt = props.createdAt
  }
}
