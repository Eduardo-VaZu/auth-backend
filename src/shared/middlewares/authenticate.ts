import type { RequestHandler } from 'express'

import { ACCESS_TOKEN_COOKIE_NAME } from '../../modules/auth/application/constants/auth.constants.js'
import type { IUserSessionRepository } from '../../modules/auth/domain/repositories/IUserSessionRepository.js'
import type { ISessionStore } from '../../modules/auth/domain/services/ISessionStore.js'
import type { ITokenService } from '../../modules/auth/domain/services/ITokenService.js'
import { UnauthorizedError } from '../errors/HttpErrors.js'

const getSignedCookie = (
  cookies: unknown,
  cookieName: string,
): string | null => {
  if (typeof cookies !== 'object' || cookies === null) {
    return null
  }

  const cookieValue = (cookies as Record<string, unknown>)[cookieName]

  return typeof cookieValue === 'string' ? cookieValue : null
}

export const createAuthenticate = (
  tokenService: ITokenService,
  sessionStore: ISessionStore,
  userSessionRepository: IUserSessionRepository,
): RequestHandler => {
  return async (request, _response, next) => {
    try {
      const accessToken = getSignedCookie(
        request.signedCookies,
        ACCESS_TOKEN_COOKIE_NAME,
      )

      if (accessToken === null) {
        throw new UnauthorizedError('Missing access token')
      }

      const payload = await tokenService.verifyAccessToken(accessToken)
      const isTokenBlacklisted = await sessionStore.isAccessTokenBlacklisted(
        payload.jti,
      )

      if (isTokenBlacklisted) {
        throw new UnauthorizedError('Access token has been revoked')
      }

      if (payload.sessionKey !== null) {
        const session = await userSessionRepository.findBySessionKey(
          payload.sessionKey,
        )

        if (
          session === null ||
          !session.isActive() ||
          session.userId !== payload.userId
        ) {
          throw new UnauthorizedError('Session is no longer active')
        }
      }

      request.user = {
        userId: payload.userId,
        role: payload.role,
        roles: payload.roles,
        authzVersion: payload.authzVersion,
        jti: payload.jti,
        sessionKey: payload.sessionKey,
      }

      next()
    } catch (error: unknown) {
      next(
        error instanceof UnauthorizedError
          ? error
          : new UnauthorizedError('Invalid access token'),
      )
    }
  }
}
