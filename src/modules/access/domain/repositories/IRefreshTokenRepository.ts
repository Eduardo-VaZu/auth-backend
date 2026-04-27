import type { RefreshToken } from '../entities/RefreshToken.js'

export interface CreateRefreshTokenParams {
  jti: string
  userId: string
  sessionId: string
  tokenHash: string
  expiresAt: Date
  userAgent: string | null
  ipAddress: string | null
}

export interface RevokeRefreshTokenParams {
  jti: string
  revokedAt?: Date
  revokedReason?: string | null
  replacedByTokenId?: string | null
  lastUsedAt?: Date | null
}

export interface RevokeAllRefreshTokensParams {
  userId: string
  revokedAt?: Date
  revokedReason?: string | null
}

export interface RevokeActiveRefreshTokenParams {
  jti: string
  revokedAt: Date
  referenceDate: Date
  revokedReason: string
  replacedByTokenId: string
  lastUsedAt: Date
}

export interface IRefreshTokenRepository {
  create(params: CreateRefreshTokenParams): Promise<RefreshToken>
  findById(id: string): Promise<RefreshToken | null>
  findByJti(jti: string): Promise<RefreshToken | null>
  revokeByJti(params: RevokeRefreshTokenParams): Promise<void>
  revokeActiveByJti(
    params: RevokeActiveRefreshTokenParams,
  ): Promise<RefreshToken | null>
  revokeAllByUserId(params: RevokeAllRefreshTokensParams): Promise<void>
  revokeAllBySessionId(
    sessionId: string,
    revokedAt?: Date,
    revokedReason?: string | null,
  ): Promise<void>
  findLatestActiveBySessionId(
    sessionId: string,
    referenceDate?: Date,
  ): Promise<RefreshToken | null>
  updateLastUsedAt(jti: string, lastUsedAt?: Date): Promise<void>
  deleteExpired(referenceDate?: Date): Promise<number>
  countActiveSessions(userId: string, referenceDate?: Date): Promise<number>
  findOldestActiveByUserId(
    userId: string,
    referenceDate?: Date,
  ): Promise<RefreshToken | null>
}
