import type { Request, Response } from 'express'
import { inject, injectable } from 'inversify'

import { TYPES } from '../../../../container/types.js'
import { RegisterUseCase } from '../../application/use-cases/RegisterUseCase.js'

@injectable()
export class IdentityController {
  public constructor(
    @inject(TYPES.RegisterUseCase)
    private readonly registerUseCase: RegisterUseCase,
  ) {}

  public async register(request: Request, response: Response): Promise<void> {
    const result = await this.registerUseCase.execute(request.body)

    response.status(201).json(result)
  }

  public async me(request: Request, response: Response): Promise<void> {
    response.status(200).json({
      user: request.user,
    })
  }
}
