import { injectable } from 'inversify'

import {
  deleteAllRefreshTokens,
  deleteRefreshToken,
  getRefreshToken,
  isBlacklisted,
  setBlacklist,
  setRefreshToken,
} from '../../../../infrastructure/redis.js'
import type { ISessionStore } from '../../domain/services/ISessionStore.js'

@injectable()
export class SessionStore implements ISessionStore {
  public async blacklistAccessToken(
    jti: string,
    ttlSeconds: number,
  ): Promise<void> {
    await setBlacklist(jti, ttlSeconds)
  }

  public async isAccessTokenBlacklisted(jti: string): Promise<boolean> {
    return isBlacklisted(jti)
  }

  public async storeRefreshToken(
    userId: string,
    jti: string,
    ttlSeconds: number,
  ): Promise<void> {
    await setRefreshToken(userId, jti, ttlSeconds)
  }

  public async hasRefreshToken(userId: string, jti: string): Promise<boolean> {
    return getRefreshToken(userId, jti)
  }

  public async deleteRefreshToken(userId: string, jti: string): Promise<void> {
    await deleteRefreshToken(userId, jti)
  }

  public async deleteAllRefreshTokens(userId: string): Promise<void> {
    await deleteAllRefreshTokens(userId)
  }
}
