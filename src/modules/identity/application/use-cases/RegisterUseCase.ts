import argon2 from 'argon2'
import { inject, injectable } from 'inversify'

import { TYPES } from '../../../../container/types.js'
import { UserAlreadyExistsError } from '../../../../shared/domain/errors/DomainErrors.js'
import type { IAuthUnitOfWork } from '../../../../shared/domain/services/IAuthUnitOfWork.js'
import { Email } from '../../domain/value-objects/Email.js'
import { Password } from '../../../credentials/domain/value-objects/Password.js'
import type { RegisterInputDto, RegisterResultDto } from '../../../access/application/dtos/AuthDtos.js'
import { toAuthUserDto } from '../../../access/application/dtos/AuthDtos.js'

@injectable()
export class RegisterUseCase {
  public constructor(
    @inject(TYPES.IAuthUnitOfWork)
    private readonly authUnitOfWork: IAuthUnitOfWork,
  ) {}

  public async execute(input: RegisterInputDto): Promise<RegisterResultDto> {
    const email = new Email(input.email)
    const password = new Password(input.password)
    const passwordHash = await argon2.hash(password.value)

    const user = await this.authUnitOfWork.run(
      async ({ userCredentialRepository, userRepository }) => {
        const existingUser = await userRepository.findByEmail(email.value)

        if (existingUser !== null) {
          throw new UserAlreadyExistsError(email.value)
        }

        const createdUser = await userRepository.create({
          email: email.value,
          role: 'user',
        })
        await userCredentialRepository.create({
          userId: createdUser.id,
          passwordHash,
        })

        return createdUser
      },
    )

    return {
      user: toAuthUserDto(user),
    }
  }
}
