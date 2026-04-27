import argon2 from 'argon2'
import { inject, injectable } from 'inversify'

import { TYPES } from '../../../../container/types.js'
import { ConflictError } from '../../../../shared/errors/HttpErrors.js'
import type { IAuthUnitOfWork } from '../../domain/services/IAuthUnitOfWork.js'
import { Email } from '../../domain/value-objects/Email.js'
import { Password } from '../../domain/value-objects/Password.js'
import type { RegisterInputDto, RegisterResultDto } from '../dtos/AuthDtos.js'
import { toAuthUserDto } from '../dtos/AuthDtos.js'

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
          throw new ConflictError('Email already in use')
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
