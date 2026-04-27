import argon2 from 'argon2'
import { inject, injectable } from 'inversify'

import { TYPES } from '../../../../container/types.js'
import { UnauthorizedError } from '../../../../shared/errors/HttpErrors.js'
import type { IUserCredentialRepository } from '../../domain/repositories/IUserCredentialRepository.js'
import type { IUserRepository } from '../../../identity/domain/repositories/IUserRepository.js'
import type { IAuthUnitOfWork } from '../../../../shared/domain/services/IAuthUnitOfWork.js'
import type { ISessionStore } from '../../../access/domain/services/ISessionStore.js'
import type { ITokenService } from '../../../access/domain/services/ITokenService.js'
import { Password } from '../../domain/value-objects/Password.js'
import type { ChangePasswordInputDto } from '../../../access/application/dtos/AuthDtos.js'

@injectable()
export class ChangePasswordUseCase {
  public constructor(
    @inject(TYPES.IUserRepository)
    private readonly userRepository: IUserRepository,
    @inject(TYPES.IUserCredentialRepository)
    private readonly userCredentialRepository: IUserCredentialRepository,
    @inject(TYPES.ITokenService)
    private readonly tokenService: ITokenService,
    @inject(TYPES.ISessionStore)
    private readonly sessionStore: ISessionStore,
    @inject(TYPES.IAuthUnitOfWork)
    private readonly authUnitOfWork: IAuthUnitOfWork,
  ) {}

  public async execute(input: ChangePasswordInputDto): Promise<void> {
    const [user, credential] = await Promise.all([
      this.userRepository.findById(input.userId),
      this.userCredentialRepository.findByUserId(input.userId),
    ])

    if (user === null || !user.canAuthenticate() || credential === null) {
      throw new UnauthorizedError('Invalid credentials')
    }

    const currentPasswordValid = await argon2.verify(
      credential.passwordHash,
      input.currentPassword,
    )

    if (!currentPasswordValid) {
      throw new UnauthorizedError('Invalid credentials')
    }

    const newPassword = new Password(input.newPassword)
    const passwordChangedAt = new Date()
    const passwordHash = await argon2.hash(newPassword.value)

    await this.authUnitOfWork.run(
      async ({
        authAuditService,
        refreshTokenRepository,
        userCredentialRepository,
        userSessionRepository,
        acquireUserMutationLock,
      }) => {
        await acquireUserMutationLock(user.id)

        await userCredentialRepository.updatePassword({
          userId: user.id,
          passwordHash,
          passwordChangedAt,
          passwordVersion: credential.passwordVersion + 1,
          mustChangePassword: false,
        })

        await userSessionRepository.revokeAllByUserId(
          user.id,
          passwordChangedAt,
          'password_changed',
        )
        await refreshTokenRepository.revokeAllByUserId({
          userId: user.id,
          revokedAt: passwordChangedAt,
          revokedReason: 'password_changed',
        })

        await authAuditService.recordEvent({
          userId: user.id,
          eventType: 'password_changed',
          eventStatus: 'success',
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          requestId: input.requestId,
          metadata: {
            sessionKey: input.sessionKey,
            passwordVersion: credential.passwordVersion + 1,
          },
        })
        await authAuditService.recordEvent({
          userId: user.id,
          eventType: 'all_sessions_revoked_after_password_change',
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

    if (input.accessToken !== null) {
      const decodedAccessToken = this.tokenService.decodeAccessToken(
        input.accessToken,
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
    }

    await this.sessionStore.deleteAllRefreshTokens(user.id)
  }
}
