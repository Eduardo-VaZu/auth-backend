import { randomUUID } from 'node:crypto'

import { decodeJwt, jwtVerify, SignJWT } from 'jose'
import { injectable } from 'inversify'

import { env } from '../../../../config/env.js'
import { UnauthorizedError } from '../../../../shared/errors/HttpErrors.js'
import type { UserRole } from '../../domain/entities/User.js'
import type {
  AccessTokenPayload,
  GeneratedToken,
  ITokenService,
  RefreshTokenPayload,
} from '../../domain/services/ITokenService.js'
import { durationToSeconds } from '../../application/utils/duration.js'

const accessTokenSecret = new TextEncoder().encode(env.ACCESS_TOKEN_SECRET)
const refreshTokenSecret = new TextEncoder().encode(env.REFRESH_TOKEN_SECRET)

const isUserRole = (value: string): value is UserRole =>
  value === 'user' || value === 'admin'

@injectable()
export class TokenService implements ITokenService {
  public async generateAccessToken(payload: {
    userId: string
    roles: UserRole[]
    authzVersion: number
    sessionKey: string
  }): Promise<GeneratedToken> {
    const jti = randomUUID()
    const ttlSeconds = durationToSeconds(
      env.ACCESS_TOKEN_EXPIRES_IN,
      'ACCESS_TOKEN_EXPIRES_IN',
    )
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000)

    const primaryRole = payload.roles[0] ?? 'user'

    const token = await new SignJWT({
      userId: payload.userId,
      role: primaryRole,
      roles: payload.roles,
      authzVersion: payload.authzVersion,
      sessionKey: payload.sessionKey,
    })
      .setProtectedHeader({
        alg: 'HS256',
      })
      .setIssuedAt()
      .setSubject(payload.userId)
      .setJti(jti)
      .setExpirationTime(env.ACCESS_TOKEN_EXPIRES_IN)
      .sign(accessTokenSecret)

    return {
      token,
      jti,
      expiresAt,
      ttlSeconds,
    }
  }

  public async generateRefreshToken(payload: {
    userId: string
  }): Promise<GeneratedToken> {
    const jti = randomUUID()
    const ttlSeconds = durationToSeconds(
      env.REFRESH_TOKEN_EXPIRES_IN,
      'REFRESH_TOKEN_EXPIRES_IN',
    )
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000)

    const token = await new SignJWT({
      userId: payload.userId,
    })
      .setProtectedHeader({
        alg: 'HS256',
      })
      .setIssuedAt()
      .setSubject(payload.userId)
      .setJti(jti)
      .setExpirationTime(env.REFRESH_TOKEN_EXPIRES_IN)
      .sign(refreshTokenSecret)

    return {
      token,
      jti,
      expiresAt,
      ttlSeconds,
    }
  }

  public async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      const { payload } = await jwtVerify(token, accessTokenSecret)
      const userId =
        typeof payload.userId === 'string' ? payload.userId : payload.sub
      const role = typeof payload.role === 'string' ? payload.role : null
      let roles: UserRole[] | null = null

      if (
        Array.isArray(payload.roles) &&
        payload.roles.every(
          (item): item is UserRole =>
            typeof item === 'string' && isUserRole(item),
        )
      ) {
        roles = payload.roles
      } else if (role !== null && isUserRole(role)) {
        roles = [role]
      }
      const authzVersion =
        typeof payload.authzVersion === 'number' ? payload.authzVersion : 1
      const jti = typeof payload.jti === 'string' ? payload.jti : null
      const sessionKey =
        typeof payload.sessionKey === 'string' ? payload.sessionKey : null
      const exp = typeof payload.exp === 'number' ? payload.exp : null

      if (
        userId === undefined ||
        role === null ||
        roles === null ||
        jti === null ||
        exp === null ||
        !isUserRole(role)
      ) {
        throw new UnauthorizedError('Invalid access token')
      }

      return {
        userId,
        role,
        roles,
        authzVersion,
        jti,
        sessionKey,
        exp,
      }
    } catch {
      throw new UnauthorizedError('Invalid access token')
    }
  }

  public async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    try {
      const { payload } = await jwtVerify(token, refreshTokenSecret)
      const userId =
        typeof payload.userId === 'string' ? payload.userId : payload.sub
      const jti = typeof payload.jti === 'string' ? payload.jti : null
      const exp = typeof payload.exp === 'number' ? payload.exp : null

      if (userId === undefined || jti === null || exp === null) {
        throw new UnauthorizedError('Invalid refresh token')
      }

      return {
        userId,
        jti,
        exp,
      }
    } catch {
      throw new UnauthorizedError('Invalid refresh token')
    }
  }

  public decodeAccessToken(token: string): AccessTokenPayload | null {
    try {
      const payload = decodeJwt(token)
      const userId =
        typeof payload.userId === 'string' ? payload.userId : payload.sub
      const role = typeof payload.role === 'string' ? payload.role : null
      let roles: UserRole[] | null = null

      if (
        Array.isArray(payload.roles) &&
        payload.roles.every(
          (item): item is UserRole =>
            typeof item === 'string' && isUserRole(item),
        )
      ) {
        roles = payload.roles
      } else if (role !== null && isUserRole(role)) {
        roles = [role]
      }
      const authzVersion =
        typeof payload.authzVersion === 'number' ? payload.authzVersion : 1
      const jti = typeof payload.jti === 'string' ? payload.jti : null
      const sessionKey =
        typeof payload.sessionKey === 'string' ? payload.sessionKey : null
      const exp = typeof payload.exp === 'number' ? payload.exp : null

      if (
        userId === undefined ||
        role === null ||
        roles === null ||
        jti === null ||
        exp === null ||
        !isUserRole(role)
      ) {
        return null
      }

      return {
        userId,
        role,
        roles,
        authzVersion,
        jti,
        sessionKey,
        exp,
      }
    } catch {
      return null
    }
  }
}
