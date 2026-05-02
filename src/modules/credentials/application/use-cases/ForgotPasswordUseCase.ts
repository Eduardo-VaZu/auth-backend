import argon2 from 'argon2'
import { randomBytes } from 'node:crypto'
import { inject, injectable } from 'inversify'

import { TYPES } from '../../../../container/types.js'
import type { IAuthUnitOfWork } from '../../../../shared/domain/services/IAuthUnitOfWork.js'
import type { IUserRepository } from '../../../identity/domain/repositories/IUserRepository.js'
import { Email } from '../../../identity/domain/value-objects/Email.js'
import type { IAuthEmailService } from '../../domain/services/IAuthEmailService.js'
import type {
  ForgotPasswordInputDto,
  OneTimeTokenDispatchResultDto,
} from '../dtos/CredentialDtos.js'

const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000

@injectable()
export class ForgotPasswordUseCase {
  public constructor(
    @inject(TYPES.IUserRepository)
    private readonly userRepository: IUserRepository,
    @inject(TYPES.IAuthUnitOfWork)
    private readonly authUnitOfWork: IAuthUnitOfWork,
    @inject(TYPES.IAuthEmailService)
    private readonly authEmailService: IAuthEmailService,
  ) {}

  public async execute(
    input: ForgotPasswordInputDto,
  ): Promise<OneTimeTokenDispatchResultDto> {
    const email = new Email(input.email)
    const user = await this.userRepository.findByEmail(email.value)

    if (user === null) {
      return {
        previewToken: null,
      }
    }

    const plainToken = randomBytes(32).toString('hex')
    const tokenHash = await argon2.hash(plainToken)
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS)

    const storedToken = await this.authUnitOfWork.run(
      async ({ authAuditService, oneTimeTokenRepository }) => {
        await oneTimeTokenRepository.invalidateActiveByUserId(
          user.id,
          'password_reset',
        )

        const createdToken = await oneTimeTokenRepository.create({
          userId: user.id,
          type: 'password_reset',
          tokenHash,
          requestedByIp: input.ipAddress,
          expiresAt,
        })

        await authAuditService.recordEvent({
          userId: user.id,
          eventType: 'password_reset_requested',
          eventStatus: 'success',
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          requestId: input.requestId,
          metadata: {
            email: email.value,
            expiresAt: expiresAt.toISOString(),
          },
        })

        return createdToken
      },
    )

    return this.authEmailService.sendPasswordResetEmail({
      email: email.value,
      token: `${storedToken.id}.${plainToken}`,
      expiresAt,
      requestId: input.requestId,
    })
  }
}
