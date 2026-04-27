import type { OneTimeToken, OneTimeTokenType } from '../entities/OneTimeToken.js'

export interface CreateOneTimeTokenParams {
  userId: string
  type: OneTimeTokenType
  tokenHash: string
  requestedByIp: string | null
  expiresAt: Date
}

export interface IOneTimeTokenRepository {
  create(params: CreateOneTimeTokenParams): Promise<OneTimeToken>
  findActiveByType(
    type: OneTimeTokenType,
    referenceDate?: Date,
  ): Promise<OneTimeToken[]>
  markAsUsed(id: string, usedAt?: Date): Promise<void>
}
