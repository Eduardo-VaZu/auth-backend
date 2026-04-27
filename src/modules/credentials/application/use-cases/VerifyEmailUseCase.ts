import argon2 from 'argon2'
import { inject, injectable } from 'inversify'

import { TYPES } from '../../../../container/types.js'
import { UnauthorizedError } from '../../../../shared/errors/HttpErrors.js'
import type { IAuthUnitOfWork } from '../../../../shared/domain/services/IAuthUnitOfWork.js'
import type { VerifyEmailInputDto } from '../dtos/CredentialDtos.js'

@injectable()
export class VerifyEmailUseCase {
  public constructor(
    @inject(TYPES.IAuthUnitOfWork)
    private readonly authUnitOfWork: IAuthUnitOfWork,
  ) {}

  public async execute(input: VerifyEmailInputDto): Promise<void> {
    const candidateTokens = await this.authUnitOfWork.run(
      async ({ oneTimeTokenRepository }) =>
        oneTimeTokenRepository.findActiveByType('email_verification'),
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
      throw new UnauthorizedError('Invalid or expired verification token')
    }

    await this.authUnitOfWork.run(
      async ({
        authAuditService,
        oneTimeTokenRepository,
        userRepository,
        acquireUserMutationLock,
      }) => {
        await acquireUserMutationLock(matchedUserId)

        const user = await userRepository.findById(matchedUserId)

        if (user === null) {
          throw new UnauthorizedError('Invalid or expired verification token')
        }

        const verifiedAt = new Date()

        await oneTimeTokenRepository.markAsUsed(matchedTokenId, verifiedAt)

        if (user.emailVerifiedAt === null) {
          await userRepository.markEmailAsVerified(matchedUserId, verifiedAt)
        }

        await authAuditService.recordEvent({
          userId: matchedUserId,
          eventType: 'email_verification_completed',
          eventStatus: 'success',
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          requestId: input.requestId,
          metadata: {
            alreadyVerified: user.emailVerifiedAt !== null,
          },
        })
      },
    )
  }
}
