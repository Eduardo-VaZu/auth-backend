export interface RefreshTokenProps {
  id: string
  jti: string
  userId: string
  sessionId: string
  tokenHash: string
  expiresAt: Date
  revokedAt: Date | null
  replacedByTokenId: string | null
  revokedReason: string | null
  lastUsedAt: Date | null
  createdAt: Date
  userAgent: string | null
  ipAddress: string | null
}

export class RefreshToken {
  public readonly id: string

  public readonly jti: string

  public readonly userId: string

  public readonly sessionId: string

  public readonly tokenHash: string

  public readonly expiresAt: Date

  public readonly revokedAt: Date | null

  public readonly replacedByTokenId: string | null

  public readonly revokedReason: string | null

  public readonly lastUsedAt: Date | null

  public readonly createdAt: Date

  public readonly userAgent: string | null

  public readonly ipAddress: string | null

  public constructor(props: RefreshTokenProps) {
    this.id = props.id
    this.jti = props.jti
    this.userId = props.userId
    this.sessionId = props.sessionId
    this.tokenHash = props.tokenHash
    this.expiresAt = props.expiresAt
    this.revokedAt = props.revokedAt
    this.replacedByTokenId = props.replacedByTokenId
    this.revokedReason = props.revokedReason
    this.lastUsedAt = props.lastUsedAt
    this.createdAt = props.createdAt
    this.userAgent = props.userAgent
    this.ipAddress = props.ipAddress
  }

  public isActive(referenceDate = new Date()): boolean {
    return this.revokedAt === null && this.expiresAt > referenceDate
  }

  public indicatesReuseIncident(): boolean {
    return this.revokedAt !== null || this.replacedByTokenId !== null
  }
}
