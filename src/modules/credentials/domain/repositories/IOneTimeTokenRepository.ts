import type {
  OneTimeToken,
  OneTimeTokenType,
} from '../entities/OneTimeToken.js'

export interface CreateOneTimeTokenParams {
  userId: string
  type: OneTimeTokenType
  tokenHash: string
  requestedByIp: string | null
  expiresAt: Date
}

export interface IOneTimeTokenRepository {
  create(params: CreateOneTimeTokenParams): Promise<OneTimeToken>
  findActiveById(
    id: string,
    type: OneTimeTokenType,
    referenceDate?: Date,
  ): Promise<OneTimeToken | null>
  invalidateActiveByUserId(
    userId: string,
    type: OneTimeTokenType,
    usedAt?: Date,
  ): Promise<void>
  markAsUsed(id: string, type: OneTimeTokenType, usedAt?: Date): Promise<void>
}
