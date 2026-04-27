import argon2 from 'argon2'
import { randomBytes } from 'node:crypto'
import { inject, injectable } from 'inversify'

import { TYPES } from '../../../../container/types.js'
import { UnauthorizedError } from '../../../../shared/errors/HttpErrors.js'
import type { IAuthUnitOfWork } from '../../../../shared/domain/services/IAuthUnitOfWork.js'
import type { ResendVerificationInputDto } from '../dtos/CredentialDtos.js'

const EMAIL_VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000

@injectable()
export class ResendVerificationUseCase {
  public constructor(
    @inject(TYPES.IAuthUnitOfWork)
    private readonly authUnitOfWork: IAuthUnitOfWork,
  ) {}

  public async execute(input: ResendVerificationInputDto): Promise<void> {
    await this.authUnitOfWork.run(
      async ({
        authAuditService,
        oneTimeTokenRepository,
        userRepository,
        acquireUserMutationLock,
      }) => {
        await acquireUserMutationLock(input.userId)

        const user = await userRepository.findById(input.userId)

        if (user === null) {
          throw new UnauthorizedError('User is no longer available')
        }

        if (user.emailVerifiedAt !== null) {
          await authAuditService.recordEvent({
            userId: user.id,
            eventType: 'email_verification_resent',
            eventStatus: 'success',
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
            requestId: input.requestId,
            metadata: {
              skipped: true,
              reason: 'already_verified',
            },
          })

          return
        }

        const plainToken = randomBytes(32).toString('hex')
        const tokenHash = await argon2.hash(plainToken)
        const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_MS)

        await oneTimeTokenRepository.create({
          userId: user.id,
          type: 'email_verification',
          tokenHash,
          requestedByIp: input.ipAddress,
          expiresAt,
        })

        await authAuditService.recordEvent({
          userId: user.id,
          eventType: 'email_verification_resent',
          eventStatus: 'success',
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          requestId: input.requestId,
          metadata: {
            email: user.email,
            expiresAt: expiresAt.toISOString(),
          },
        })
      },
    )
  }
}
