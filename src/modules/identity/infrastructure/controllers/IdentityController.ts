import type { Request, Response } from 'express'
import { inject, injectable } from 'inversify'

import { TYPES } from '../../../../container/types.js'
import type { RegisterInputDto } from '../../../access/application/dtos/AuthDtos.js'
import { toAuthUserDto } from '../../../access/application/dtos/AuthDtos.js'
import type { IUserRepository } from '../../domain/repositories/IUserRepository.js'
import { RegisterUseCase } from '../../application/use-cases/RegisterUseCase.js'
import { UnauthorizedError } from '../../../../shared/errors/HttpErrors.js'

@injectable()
export class IdentityController {
  public constructor(
    @inject(TYPES.RegisterUseCase)
    private readonly registerUseCase: RegisterUseCase,
    @inject(TYPES.IUserRepository)
    private readonly userRepository: IUserRepository,
  ) {}

  public async register(request: Request, response: Response): Promise<void> {
    const result = await this.registerUseCase.execute(
      request.body as RegisterInputDto,
    )

    response.status(201).json(result)
  }

  public async me(request: Request, response: Response): Promise<void> {
    if (request.user === undefined) {
      throw new UnauthorizedError('Missing authenticated user context')
    }

    const user = await this.userRepository.findById(request.user.userId)

    if (user === null) {
      throw new UnauthorizedError('User is no longer available')
    }

    response.status(200).json({
      user: toAuthUserDto(user),
    })
  }
}
