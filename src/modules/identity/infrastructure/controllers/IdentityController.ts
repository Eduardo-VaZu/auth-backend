import type { Request, Response } from 'express'
import { inject, injectable } from 'inversify'

import { TYPES } from '../../../../container/types.js'
import {
  ACCESS_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
} from '../../../access/application/constants/auth.constants.js'
import type { RegisterInputDto } from '../../../access/application/dtos/AuthDtos.js'
import { toAuthUserDto } from '../../../access/application/dtos/AuthDtos.js'
import { LoginUseCase } from '../../../access/application/use-cases/LoginUseCase.js'
import {
  getAccessTokenCookieOptions,
  getRefreshTokenCookieOptions,
} from '../../../access/infrastructure/controllers/cookieOptions.js'
import type { IUserRepository } from '../../domain/repositories/IUserRepository.js'
import { RegisterUseCase } from '../../application/use-cases/RegisterUseCase.js'
import { UnauthorizedError } from '../../../../shared/errors/HttpErrors.js'

@injectable()
export class IdentityController {
  public constructor(
    @inject(TYPES.RegisterUseCase)
    private readonly registerUseCase: RegisterUseCase,
    @inject(TYPES.LoginUseCase)
    private readonly loginUseCase: LoginUseCase,
    @inject(TYPES.IUserRepository)
    private readonly userRepository: IUserRepository,
  ) {}

  public async register(request: Request, response: Response): Promise<void> {
    const body = request.body as RegisterInputDto
    const result = await this.registerUseCase.execute(body)
    const loginResult = await this.loginUseCase.execute({
      email: body.email,
      password: body.password,
      requestId: request.requestId ?? null,
      userAgent: request.get('user-agent') ?? null,
      ipAddress: request.ip ?? null,
    })

    response.cookie(
      ACCESS_TOKEN_COOKIE_NAME,
      loginResult.accessToken,
      getAccessTokenCookieOptions(),
    )
    response.cookie(
      REFRESH_TOKEN_COOKIE_NAME,
      loginResult.refreshToken,
      getRefreshTokenCookieOptions(),
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
