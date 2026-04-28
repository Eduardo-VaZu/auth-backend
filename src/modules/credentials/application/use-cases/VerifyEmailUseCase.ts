import argon2 from 'argon2'
import { inject, injectable } from 'inversify'

import { TYPES } from '../../../../container/types.js'
import { UnauthorizedError } from '../../../../shared/errors/HttpErrors.js'
import type { IAuthUnitOfWork } from '../../../../shared/domain/services/IAuthUnitOfWork.js'
import type { VerifyEmailInputDto } from '../dtos/CredentialDtos.js'
import { parseOneTimeToken } from '../utils/parseOneTimeToken.js'

@injectable()
export class VerifyEmailUseCase {
  public constructor(
    @inject(TYPES.IAuthUnitOfWork)
    private readonly authUnitOfWork: IAuthUnitOfWork,
  ) {}

  public async execute(input: VerifyEmailInputDto): Promise<void> {
    const parsedToken = parseOneTimeToken(input.token)

    if (parsedToken === null) {
      throw new UnauthorizedError('Invalid or expired verification token')
    }

    const candidateToken = await this.authUnitOfWork.run(
      async ({ oneTimeTokenRepository }) =>
        oneTimeTokenRepository.findActiveById(
          parsedToken.tokenId,
          'email_verification',
        ),
    )

    if (
      candidateToken === null ||
      !(await argon2.verify(candidateToken.tokenHash, parsedToken.secret))
    ) {
      throw new UnauthorizedError('Invalid or expired verification token')
    }

    const matchedTokenId = candidateToken.id
    const matchedUserId = candidateToken.userId

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

        await oneTimeTokenRepository.markAsUsed(
          matchedTokenId,
          'email_verification',
          verifiedAt,
        )

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
