import argon2 from 'argon2'
import { inject, injectable } from 'inversify'

import { TYPES } from '../../../../container/types.js'
import type { ISessionStore } from '../../../access/domain/services/ISessionStore.js'
import { UnauthorizedError } from '../../../../shared/errors/HttpErrors.js'
import type { IAuthUnitOfWork } from '../../../../shared/domain/services/IAuthUnitOfWork.js'
import type { IUserCredentialRepository } from '../../domain/repositories/IUserCredentialRepository.js'
import { Password } from '../../domain/value-objects/Password.js'
import type { ResetPasswordInputDto } from '../dtos/CredentialDtos.js'

@injectable()
export class ResetPasswordUseCase {
  public constructor(
    @inject(TYPES.IUserCredentialRepository)
    private readonly userCredentialRepository: IUserCredentialRepository,
    @inject(TYPES.ISessionStore)
    private readonly sessionStore: ISessionStore,
    @inject(TYPES.IAuthUnitOfWork)
    private readonly authUnitOfWork: IAuthUnitOfWork,
  ) {}

  public async execute(input: ResetPasswordInputDto): Promise<void> {
    const candidateTokens = await this.authUnitOfWork.run(
      async ({ oneTimeTokenRepository }) =>
        oneTimeTokenRepository.findActiveByType('password_reset'),
    )

    let matchedTokenId: string | null = null
    let matchedUserId: string | null = null

    for (const candidate of candidateTokens) {
      if (await argon2.verify(candidate.tokenHash, input.token)) {
        matchedTokenId = candidate.id
        matchedUserId = candidate.userId
        break
      }
    }

    if (matchedTokenId === null || matchedUserId === null) {
      throw new UnauthorizedError('Invalid or expired reset token')
    }

    const credential =
      await this.userCredentialRepository.findByUserId(matchedUserId)

    if (credential === null) {
      throw new UnauthorizedError('Invalid or expired reset token')
    }

    const newPassword = new Password(input.newPassword)
    const passwordChangedAt = new Date()
    const passwordHash = await argon2.hash(newPassword.value)

    await this.authUnitOfWork.run(
      async ({
        authAuditService,
        oneTimeTokenRepository,
        refreshTokenRepository,
        userCredentialRepository,
        userSessionRepository,
        acquireUserMutationLock,
      }) => {
        await acquireUserMutationLock(matchedUserId)

        await oneTimeTokenRepository.markAsUsed(matchedTokenId, passwordChangedAt)
        await userCredentialRepository.updatePassword({
          userId: matchedUserId,
          passwordHash,
          passwordChangedAt,
          passwordVersion: credential.passwordVersion + 1,
          mustChangePassword: false,
        })
        await userSessionRepository.revokeAllByUserId(
          matchedUserId,
          passwordChangedAt,
          'password_reset',
        )
        await refreshTokenRepository.revokeAllByUserId({
          userId: matchedUserId,
          revokedAt: passwordChangedAt,
          revokedReason: 'password_reset',
        })

        await authAuditService.recordEvent({
          userId: matchedUserId,
          eventType: 'password_reset_completed',
          eventStatus: 'success',
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          requestId: input.requestId,
          metadata: {
            passwordVersion: credential.passwordVersion + 1,
          },
        })
        await authAuditService.recordEvent({
          userId: matchedUserId,
          eventType: 'all_sessions_revoked_after_password_reset',
          eventStatus: 'success',
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          requestId: input.requestId,
          metadata: {},
        })
      },
    )

    await this.sessionStore.deleteAllRefreshTokens(matchedUserId)
  }
}
