import { inject, injectable } from 'inversify'

import { TYPES } from '../../../../container/types.js'
import type { IAuthUnitOfWork } from '../../../../shared/domain/services/IAuthUnitOfWork.js'
import type { ISessionStore } from '../../domain/services/ISessionStore.js'
import type { ITokenService } from '../../domain/services/ITokenService.js'
import type { LogoutInputDto } from '../dtos/AuthDtos.js'

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
    // OWASP-DEMO (A02 - Cryptographic Failures / Session Management):
    // Logout only blacklists the short-lived access token and emits an
    // audit event. The refresh token is NOT invalidated on the server
    // side (neither in the database nor in Redis) and the session
    // record in user_sessions is NOT revoked. An attacker who captured
    // the refresh cookie before this call can keep issuing new access
    // tokens with it indefinitely — until natural refresh expiry.
    let resolvedUserId = input.userId
    let resolvedSessionKey = input.sessionKey

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

    await this.authUnitOfWork.run(async ({ authAuditService }) => {
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
    })
  }
}
