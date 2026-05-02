import argon2 from 'argon2'
import { inject, injectable } from 'inversify'

import { TYPES } from '../../../../container/types.js'
import { UnauthorizedError } from '../../../../shared/errors/HttpErrors.js'
import type { IRefreshTokenRepository } from '../../domain/repositories/IRefreshTokenRepository.js'
import type { IUserRepository } from '../../../identity/domain/repositories/IUserRepository.js'
import type { ISessionStore } from '../../domain/services/ISessionStore.js'
import type { ITokenService } from '../../domain/services/ITokenService.js'
import type { IAuthUnitOfWork } from '../../../../shared/domain/services/IAuthUnitOfWork.js'
import type {
  RefreshTokenInputDto,
  RefreshTokenResultDto,
} from '../dtos/AuthDtos.js'

const getDeviceName = (userAgent: string | null): string | null => {
  if (!userAgent) return null
  
  let os = 'Unknown OS'
  if (userAgent.includes('Win')) os = 'Windows'
  else if (userAgent.includes('Mac')) os = 'macOS'
  else if (userAgent.includes('Linux')) os = 'Linux'
  else if (userAgent.includes('Android')) os = 'Android'
  else if (userAgent.includes('like Mac OS X')) os = 'iOS'

  let browser = 'Unknown Browser'
  if (userAgent.includes('Edg/')) browser = 'Edge'
  else if (userAgent.includes('Chrome/')) browser = 'Chrome'
  else if (userAgent.includes('Firefox/')) browser = 'Firefox'
  else if (userAgent.includes('Safari/') && !userAgent.includes('Chrome/')) browser = 'Safari'
  else if (userAgent.includes('Opera/') || userAgent.includes('OPR/')) browser = 'Opera'

  return `${os} · ${browser}`
}

class RefreshTokenRotationConflictError extends Error {
  public constructor() {
    super('Refresh token rotation conflict')
  }
}

@injectable()
export class RefreshTokenUseCase {
  public constructor(
    @inject(TYPES.IRefreshTokenRepository)
    private readonly refreshTokenRepository: IRefreshTokenRepository,
    @inject(TYPES.IUserRepository)
    private readonly userRepository: IUserRepository,
    @inject(TYPES.ITokenService)
    private readonly tokenService: ITokenService,
    @inject(TYPES.ISessionStore)
    private readonly sessionStore: ISessionStore,
    @inject(TYPES.IAuthUnitOfWork)
    private readonly authUnitOfWork: IAuthUnitOfWork,
  ) {}

  public async execute(
    input: RefreshTokenInputDto,
  ): Promise<RefreshTokenResultDto> {
    const payload = await this.tokenService.verifyRefreshToken(
      input.refreshToken,
    )
    const [existsInRedis, storedRefreshToken] = await Promise.all([
      this.sessionStore.hasRefreshToken(payload.userId, payload.jti),
      this.refreshTokenRepository.findByJti(payload.jti),
    ])

    if (storedRefreshToken === null) {
      throw new UnauthorizedError('Refresh token is invalid or expired')
    }

    if (
      storedRefreshToken.revokedAt !== null ||
      storedRefreshToken.replacedByTokenId !== null
    ) {
      await this.handleReuseIncident(
        payload.userId,
        storedRefreshToken.jti,
        input,
      )
      throw new UnauthorizedError('Refresh token is invalid or expired')
    }

    if (!existsInRedis || storedRefreshToken.expiresAt <= new Date()) {
      throw new UnauthorizedError('Refresh token is invalid or expired')
    }

    const tokenMatches = await argon2.verify(
      storedRefreshToken.tokenHash,
      input.refreshToken,
    )

    if (!tokenMatches) {
      await this.handleReuseIncident(
        payload.userId,
        storedRefreshToken.jti,
        input,
      )
      throw new UnauthorizedError('Refresh token is invalid or expired')
    }

    const user = await this.userRepository.findById(payload.userId)
    const session = await this.authUnitOfWork.run(
      async ({ userSessionRepository }) =>
        userSessionRepository.findById(storedRefreshToken.sessionId),
    )

    if (user === null || !user.canAuthenticate() || session === null) {
      throw new UnauthorizedError('User no longer exists')
    }

    if (!session.isActive() || session.userId !== user.id) {
      throw new UnauthorizedError('Session is no longer active')
    }

    const refreshToken = await this.tokenService.generateRefreshToken({
      userId: user.id,
    })
    const accessToken = await this.tokenService.generateAccessToken({
      userId: user.id,
      roles: user.roles,
      authzVersion: user.authzVersion,
      sessionKey: session.sessionKey,
    })
    const rotatedAt = new Date()
    const refreshTokenHash = await argon2.hash(refreshToken.token)

    await this.sessionStore.storeRefreshToken(
      user.id,
      refreshToken.jti,
      refreshToken.ttlSeconds,
    )

    try {
      await this.authUnitOfWork.run(
        async ({
          authAuditService,
          refreshTokenRepository,
          userSessionRepository,
          acquireUserMutationLock,
        }) => {
          await acquireUserMutationLock(user.id)

          const newStoredRefreshToken = await refreshTokenRepository.create({
            jti: refreshToken.jti,
            userId: user.id,
            sessionId: session.id,
            tokenHash: refreshTokenHash,
            expiresAt: refreshToken.expiresAt,
            userAgent: input.userAgent,
            ipAddress: input.ipAddress,
          })

          const rotatedRefreshToken =
            await refreshTokenRepository.revokeActiveByJti({
              jti: payload.jti,
              revokedAt: rotatedAt,
              referenceDate: rotatedAt,
              revokedReason: 'rotated',
              replacedByTokenId: newStoredRefreshToken.id,
              lastUsedAt: rotatedAt,
            })

          if (rotatedRefreshToken === null) {
            throw new RefreshTokenRotationConflictError()
          }

          await userSessionRepository.rotateSession({
            currentSessionKey: session.sessionKey,
            expiresAt: refreshToken.expiresAt,
            authzVersion: user.authzVersion,
            userAgent: input.userAgent,
            ipAddress: input.ipAddress,
            deviceName: getDeviceName(input.userAgent),
            lastActivityAt: rotatedAt,
          })

          await authAuditService.recordEvent({
            userId: user.id,
            eventType: 'refresh_success',
            eventStatus: 'success',
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
            requestId: input.requestId,
            metadata: {
              sessionId: session.id,
              sessionKey: session.sessionKey,
              replacedJti: payload.jti,
              nextJti: refreshToken.jti,
            },
          })
        },
      )
    } catch (error: unknown) {
      await this.sessionStore.deleteRefreshToken(user.id, refreshToken.jti)

      if (error instanceof RefreshTokenRotationConflictError) {
        await this.handleReuseIncident(payload.userId, payload.jti, input)
        throw new UnauthorizedError('Refresh token is invalid or expired')
      }

      throw error
    }

    await this.sessionStore.deleteRefreshToken(payload.userId, payload.jti)

    return {
      accessToken: accessToken.token,
      refreshToken: refreshToken.token,
    }
  }

  private async handleReuseIncident(
    userId: string,
    jti: string,
    input: RefreshTokenInputDto,
  ): Promise<void> {
    await this.authUnitOfWork.run(
      async ({
        authAuditService,
        refreshTokenRepository,
        userSessionRepository,
        acquireUserMutationLock,
      }) => {
        await acquireUserMutationLock(userId)

        await userSessionRepository.revokeAllByUserId(
          userId,
          new Date(),
          'refresh_token_reuse_detected',
        )
        await refreshTokenRepository.revokeAllByUserId({
          userId,
          revokedReason: 'refresh_token_reuse_detected',
        })

        await authAuditService.recordEvent({
          userId,
          eventType: 'refresh_token_reuse_detected',
          eventStatus: 'incident',
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          requestId: input.requestId,
          metadata: {
            jti,
          },
        })
        await authAuditService.recordEvent({
          userId,
          eventType: 'all_sessions_revoked_after_reuse',
          eventStatus: 'success',
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          requestId: input.requestId,
          metadata: {
            jti,
          },
        })
      },
    )
    await this.sessionStore.deleteAllRefreshTokens(userId)
  }
}
