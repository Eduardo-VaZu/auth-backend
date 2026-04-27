import type { UserSession } from '../entities/UserSession.js'

export interface CreateUserSessionParams {
  userId: string
  sessionKey: string
  authzVersion: number
  deviceName: string | null
  deviceFingerprint: string | null
  userAgent: string | null
  ipAddress: string | null
  expiresAt: Date
  lastActivityAt?: Date
}

export interface UpdateSessionRotationParams {
  currentSessionKey: string
  expiresAt: Date
  authzVersion: number
  userAgent: string | null
  ipAddress: string | null
  deviceName: string | null
  lastActivityAt?: Date
}

export interface IUserSessionRepository {
  create(params: CreateUserSessionParams): Promise<UserSession>
  findBySessionKey(sessionKey: string): Promise<UserSession | null>
  findById(id: string): Promise<UserSession | null>
  listActiveByUserId(
    userId: string,
    referenceDate?: Date,
  ): Promise<UserSession[]>
  countActiveByUserId(userId: string, referenceDate?: Date): Promise<number>
  findOldestActiveByUserId(
    userId: string,
    referenceDate?: Date,
  ): Promise<UserSession | null>
  rotateSession(params: UpdateSessionRotationParams): Promise<void>
  revokeBySessionKey(
    sessionKey: string,
    revokedAt?: Date,
    revokedReason?: string | null,
  ): Promise<void>
  revokeById(
    sessionId: string,
    revokedAt?: Date,
    revokedReason?: string | null,
  ): Promise<void>
  revokeAllByUserId(
    userId: string,
    revokedAt?: Date,
    revokedReason?: string | null,
  ): Promise<void>
}
