import { inject, injectable } from 'inversify'

import { TYPES } from '../../../../container/types.js'
import { UnauthorizedError } from '../../../../shared/errors/HttpErrors.js'
import type { IAuthUnitOfWork } from '../../domain/services/IAuthUnitOfWork.js'
import type { ISessionStore } from '../../domain/services/ISessionStore.js'
import type { ITokenService } from '../../domain/services/ITokenService.js'
import type { LogoutAllInputDto } from '../dtos/AuthDtos.js'

@injectable()
export class LogoutAllUseCase {
  public constructor(
    @inject(TYPES.ITokenService)
    private readonly tokenService: ITokenService,
    @inject(TYPES.ISessionStore)
    private readonly sessionStore: ISessionStore,
    @inject(TYPES.IAuthUnitOfWork)
    private readonly authUnitOfWork: IAuthUnitOfWork,
  ) {}

  public async execute(input: LogoutAllInputDto): Promise<void> {
    const decodedAccessToken =
      input.accessToken === null
        ? null
        : this.tokenService.decodeAccessToken(input.accessToken)
    const resolvedUserId = input.userId ?? decodedAccessToken?.userId ?? null

    if (resolvedUserId === null) {
      throw new UnauthorizedError('Missing authenticated user')
    }

    const revokedAt = new Date()

    await this.authUnitOfWork.run(
      async ({
        authAuditService,
        refreshTokenRepository,
        userSessionRepository,
        acquireUserMutationLock,
      }) => {
        await acquireUserMutationLock(resolvedUserId)

        await userSessionRepository.revokeAllByUserId(
          resolvedUserId,
          revokedAt,
          'logout_all',
        )
        await refreshTokenRepository.revokeAllByUserId({
          userId: resolvedUserId,
          revokedAt,
          revokedReason: 'logout_all',
        })

        await authAuditService.recordEvent({
          userId: resolvedUserId,
          eventType: 'logout_all_success',
          eventStatus: 'success',
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          requestId: input.requestId,
          metadata: {
            sessionKey: input.sessionKey,
          },
        })
      },
    )

    if (decodedAccessToken !== null) {
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

    await this.sessionStore.deleteAllRefreshTokens(resolvedUserId)
  }
}
