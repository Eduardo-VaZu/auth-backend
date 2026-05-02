import argon2 from 'argon2'
import { randomBytes } from 'node:crypto'
import { inject, injectable } from 'inversify'

import { TYPES } from '../../../../container/types.js'
import { UserAlreadyExistsError } from '../../../../shared/domain/errors/DomainErrors.js'
import type { IAuthUnitOfWork } from '../../../../shared/domain/services/IAuthUnitOfWork.js'
import type { IAuthEmailService } from '../../../credentials/domain/services/IAuthEmailService.js'
import { Password } from '../../../credentials/domain/value-objects/Password.js'
import type {
  RegisterInputDto,
  RegisterResultDto,
} from '../../../access/application/dtos/AuthDtos.js'
import { toAuthUserDto } from '../../../access/application/dtos/AuthDtos.js'
import { Email } from '../../domain/value-objects/Email.js'

const EMAIL_VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000

@injectable()
export class RegisterUseCase {
  public constructor(
    @inject(TYPES.IAuthUnitOfWork)
    private readonly authUnitOfWork: IAuthUnitOfWork,
    @inject(TYPES.IAuthEmailService)
    private readonly authEmailService: IAuthEmailService,
  ) {}

  public async execute(input: RegisterInputDto): Promise<RegisterResultDto> {
    const email = new Email(input.email)
    const password = new Password(input.password)
    const passwordHash = await argon2.hash(password.value)
    const plainToken = randomBytes(32).toString('hex')
    const tokenHash = await argon2.hash(plainToken)
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_MS)

    const { user, verificationTokenId } = await this.authUnitOfWork.run(
      async ({ oneTimeTokenRepository, userCredentialRepository, userRepository }) => {
        const existingUser = await userRepository.findByEmail(email.value)

        if (existingUser !== null) {
          throw new UserAlreadyExistsError(email.value)
        }

        const createdUser = await userRepository.create({
          email: email.value,
          role: 'user',
          status: 'pending_verification',
        })
        await userCredentialRepository.create({
          userId: createdUser.id,
          passwordHash,
        })
        await oneTimeTokenRepository.invalidateActiveByUserId(
          createdUser.id,
          'email_verification',
        )

        const verificationToken = await oneTimeTokenRepository.create({
          userId: createdUser.id,
          type: 'email_verification',
          tokenHash,
          requestedByIp: null,
          expiresAt,
        })

        return {
          user: createdUser,
          verificationTokenId: verificationToken.id,
        }
      },
    )

    const dispatchResult = await this.authEmailService.sendVerificationEmail({
      email: email.value,
      token: `${verificationTokenId}.${plainToken}`,
      expiresAt,
      requestId: input.requestId,
      reason: 'register',
    })

    return {
      user: toAuthUserDto(user),
      verificationRequired: true,
      message: 'Verify your email before signing in',
      ...(dispatchResult.previewToken === null
        ? {}
        : { previewToken: dispatchResult.previewToken }),
    }
  }
}
