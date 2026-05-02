import argon2 from 'argon2'
import { randomBytes } from 'node:crypto'
import { inject, injectable } from 'inversify'

import { TYPES } from '../../../../container/types.js'
import type { IAuthUnitOfWork } from '../../../../shared/domain/services/IAuthUnitOfWork.js'
import type { IUserRepository } from '../../../identity/domain/repositories/IUserRepository.js'
import { Email } from '../../../identity/domain/value-objects/Email.js'
import type { IAuthEmailService } from '../../domain/services/IAuthEmailService.js'
import type {
  OneTimeTokenDispatchResultDto,
  ResendVerificationInputDto,
} from '../dtos/CredentialDtos.js'

const EMAIL_VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000

@injectable()
export class ResendVerificationUseCase {
  public constructor(
    @inject(TYPES.IUserRepository)
    private readonly userRepository: IUserRepository,
    @inject(TYPES.IAuthUnitOfWork)
    private readonly authUnitOfWork: IAuthUnitOfWork,
    @inject(TYPES.IAuthEmailService)
    private readonly authEmailService: IAuthEmailService,
  ) {}

  public async execute(
    input: ResendVerificationInputDto,
  ): Promise<OneTimeTokenDispatchResultDto> {
    const email = new Email(input.email)
    const user = await this.userRepository.findByEmail(email.value)

    if (user === null || user.emailVerifiedAt !== null) {
      return {
        previewToken: null,
      }
    }

    const plainToken = randomBytes(32).toString('hex')
    const tokenHash = await argon2.hash(plainToken)
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_MS)

    const storedToken = await this.authUnitOfWork.run(
      async ({
        authAuditService,
        oneTimeTokenRepository,
        acquireUserMutationLock,
      }) => {
        await acquireUserMutationLock(user.id)
        await oneTimeTokenRepository.invalidateActiveByUserId(
          user.id,
          'email_verification',
        )

        const createdToken = await oneTimeTokenRepository.create({
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

        return createdToken
      },
    )

    return this.authEmailService.sendVerificationEmail({
      email: user.email,
      token: `${storedToken.id}.${plainToken}`,
      expiresAt,
      requestId: input.requestId,
      reason: 'resend_verification',
    })
  }
}
