export interface UserSessionProps {
  id: string
  userId: string
  sessionKey: string
  authzVersion: number
  deviceName: string | null
  deviceFingerprint: string | null
  userAgent: string | null
  ipAddress: string | null
  lastActivityAt: Date
  expiresAt: Date
  revokedAt: Date | null
  revokedReason: string | null
  createdAt: Date
}

export class UserSession {
  public readonly id: string

  public readonly userId: string

  public readonly sessionKey: string

  public readonly authzVersion: number

  public readonly deviceName: string | null

  public readonly deviceFingerprint: string | null

  public readonly userAgent: string | null

  public readonly ipAddress: string | null

  public readonly lastActivityAt: Date

  public readonly expiresAt: Date

  public readonly revokedAt: Date | null

  public readonly revokedReason: string | null

  public readonly createdAt: Date

  public constructor(props: UserSessionProps) {
    this.id = props.id
    this.userId = props.userId
    this.sessionKey = props.sessionKey
    this.authzVersion = props.authzVersion
    this.deviceName = props.deviceName
    this.deviceFingerprint = props.deviceFingerprint
    this.userAgent = props.userAgent
    this.ipAddress = props.ipAddress
    this.lastActivityAt = props.lastActivityAt
    this.expiresAt = props.expiresAt
    this.revokedAt = props.revokedAt
    this.revokedReason = props.revokedReason
    this.createdAt = props.createdAt
  }

  public isActive(referenceDate = new Date()): boolean {
    return this.revokedAt === null && this.expiresAt > referenceDate
  }
}
