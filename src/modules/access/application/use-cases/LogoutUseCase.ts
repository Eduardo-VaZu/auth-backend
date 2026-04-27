import { inject, injectable } from 'inversify'

import { TYPES } from '../../../../container/types.js'
import type { IAuthUnitOfWork } from '../../../../shared/domain/services/IAuthUnitOfWork.js'
import type { ISessionStore } from '../../domain/services/ISessionStore.js'
import type { ITokenService } from '../../domain/services/ITokenService.js'
import type { LogoutInputDto } from '../dtos/AuthDtos.js'

interface RefreshTokenRevocation {
  userId: string
  jti: string
}

@injectable()
export class LogoutUseCase {
  public constructor(
    @inject(TYPES.ITokenService)
    private readonly tokenService: ITokenService,
    @inject(TYPES.ISessionStore)
    private readonly sessionStore: ISessionStore,
    @inject(TYPES.IAuthUnitOfWork)
    private readonly authUnitOfWork: IAuthUnitOfWork,
  ) {}

  public async execute(input: LogoutInputDto): Promise<void> {
    let resolvedUserId = input.userId
    let resolvedSessionKey = input.sessionKey
    let refreshTokenRevocation: RefreshTokenRevocation | null = null

    if (input.accessToken !== null) {
      const decodedAccessToken = this.tokenService.decodeAccessToken(
        input.accessToken,
      )

      if (decodedAccessToken !== null) {
        const ttlSeconds = Math.max(
          decodedAccessToken.exp - Math.floor(Date.now() / 1000),
          0,
        )
        resolvedUserId ??= decodedAccessToken.userId
        resolvedSessionKey ??= decodedAccessToken.sessionKey

        if (ttlSeconds > 0) {
          await this.sessionStore.blacklistAccessToken(
            decodedAccessToken.jti,
            ttlSeconds,
          )
        }
      }
    }

    if (input.refreshToken !== null) {
      try {
        const decodedRefreshToken = await this.tokenService.verifyRefreshToken(
          input.refreshToken,
        )

        resolvedUserId ??= decodedRefreshToken.userId
        refreshTokenRevocation = {
          userId: decodedRefreshToken.userId,
          jti: decodedRefreshToken.jti,
        }
      } catch {
        // Logout is best-effort and must remain idempotent.
      }
    }

    await this.authUnitOfWork.run(
      async ({
        authAuditService,
        refreshTokenRepository,
        userSessionRepository,
        acquireUserMutationLock,
      }) => {
        if (resolvedUserId !== null) {
          await acquireUserMutationLock(resolvedUserId)
        }

        if (refreshTokenRevocation !== null) {
          const storedRefreshToken = await refreshTokenRepository.findByJti(
            refreshTokenRevocation.jti,
          )

          await refreshTokenRepository.revokeByJti({
            jti: refreshTokenRevocation.jti,
            revokedReason: 'logout',
          })

          if (resolvedSessionKey === null && storedRefreshToken !== null) {
            const session = await userSessionRepository.findById(
              storedRefreshToken.sessionId,
            )

            resolvedSessionKey = session?.sessionKey ?? null
          }
        }

        if (resolvedSessionKey !== null) {
          await userSessionRepository.revokeBySessionKey(
            resolvedSessionKey,
            new Date(),
            'logout',
          )
        }

        await authAuditService.recordEvent({
          userId: resolvedUserId ?? null,
          eventType: 'logout_success',
          eventStatus: 'success',
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          requestId: input.requestId,
          metadata: {
            sessionKey: resolvedSessionKey,
          },
        })
      },
    )

    if (refreshTokenRevocation !== null) {
      await this.sessionStore.deleteRefreshToken(
        refreshTokenRevocation.userId,
        refreshTokenRevocation.jti,
      )
    }
  }
}
