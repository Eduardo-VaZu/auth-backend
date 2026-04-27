import type { UserRole } from '../entities/User.js'

export interface GeneratedToken {
  token: string
  jti: string
  expiresAt: Date
  ttlSeconds: number
}

export interface AccessTokenPayload {
  userId: string
  role: UserRole
  roles: UserRole[]
  authzVersion: number
  jti: string
  sessionKey: string | null
  exp: number
}

export interface RefreshTokenPayload {
  userId: string
  jti: string
  exp: number
}

export interface ITokenService {
  generateAccessToken(payload: {
    userId: string
    roles: UserRole[]
    authzVersion: number
    sessionKey: string
  }): Promise<GeneratedToken>
  generateRefreshToken(payload: { userId: string }): Promise<GeneratedToken>
  verifyAccessToken(token: string): Promise<AccessTokenPayload>
  verifyRefreshToken(token: string): Promise<RefreshTokenPayload>
  decodeAccessToken(token: string): AccessTokenPayload | null
}
