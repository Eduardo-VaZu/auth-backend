import { inject, injectable } from 'inversify'

import { TYPES } from '../../../../container/types.js'
import { NotFoundError } from '../../../../shared/errors/HttpErrors.js'
import type { IAuthUnitOfWork } from '../../../../shared/domain/services/IAuthUnitOfWork.js'
import type { ISessionStore } from '../../domain/services/ISessionStore.js'
import type { ITokenService } from '../../domain/services/ITokenService.js'
import type {
  RevokeSessionInputDto,
  RevokeSessionResultDto,
} from '../dtos/AuthDtos.js'

@injectable()
export class RevokeSessionUseCase {
  public constructor(
    @inject(TYPES.ITokenService)
    private readonly tokenService: ITokenService,
    @inject(TYPES.ISessionStore)
    private readonly sessionStore: ISessionStore,
    @inject(TYPES.IAuthUnitOfWork)
    private readonly authUnitOfWork: IAuthUnitOfWork,
  ) {}

  public async execute(
    input: RevokeSessionInputDto,
  ): Promise<RevokeSessionResultDto> {
    const decodedAccessToken =
      input.accessToken === null
        ? null
        : this.tokenService.decodeAccessToken(input.accessToken)
    const revokedAt = new Date()

    const result = await this.authUnitOfWork.run(
      async ({
        authAuditService,
        refreshTokenRepository,
        userSessionRepository,
        acquireUserMutationLock,
      }) => {
        await acquireUserMutationLock(input.userId)

        const session = await userSessionRepository.findById(input.sessionId)

        if (
          session === null ||
          session.userId !== input.userId ||
          !session.isActive(revokedAt)
        ) {
          throw new NotFoundError('Session not found')
        }

        const latestRefreshToken =
          await refreshTokenRepository.findLatestActiveBySessionId(
            input.sessionId,
            revokedAt,
          )
        const isCurrentSession =
          input.currentSessionKey !== null &&
          session.sessionKey === input.currentSessionKey

        await userSessionRepository.revokeById(
          input.sessionId,
          revokedAt,
          'session_revoked',
        )
        await refreshTokenRepository.revokeAllBySessionId(
          input.sessionId,
          revokedAt,
          'session_revoked',
        )

        await authAuditService.recordEvent({
          userId: input.userId,
          eventType: 'session_revoked',
          eventStatus: 'success',
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          requestId: input.requestId,
          metadata: {
            sessionId: input.sessionId,
            sessionKey: session.sessionKey,
            isCurrentSession,
          },
        })

        return {
          isCurrentSession,
          latestRefreshTokenJti: latestRefreshToken?.jti ?? null,
        }
      },
    )

    if (result.latestRefreshTokenJti !== null) {
      await this.sessionStore.deleteRefreshToken(
        input.userId,
        result.latestRefreshTokenJti,
      )
    }

    if (
      result.isCurrentSession &&
      decodedAccessToken !== null &&
      decodedAccessToken.sessionKey === input.currentSessionKey
    ) {
      const ttlSeconds = Math.max(
        decodedAccessToken.exp - Math.floor(Date.now() / 1000),
        0,
      )

      if (ttlSeconds > 0) {
        await this.sessionStore.blacklistAccessToken(
          decodedAccessToken.jti,
          ttlSeconds,
        )
      }
    }

    return {
      isCurrentSession: result.isCurrentSession,
    }
  }
}
