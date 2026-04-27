export interface ISessionStore {
  blacklistAccessToken(jti: string, ttlSeconds: number): Promise<void>
  isAccessTokenBlacklisted(jti: string): Promise<boolean>
  storeRefreshToken(
    userId: string,
    jti: string,
    ttlSeconds: number,
  ): Promise<void>
  hasRefreshToken(userId: string, jti: string): Promise<boolean>
  deleteRefreshToken(userId: string, jti: string): Promise<void>
  deleteAllRefreshTokens(userId: string): Promise<void>
}
