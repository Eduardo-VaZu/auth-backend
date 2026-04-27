import type { Request, Response } from 'express'
import { inject, injectable } from 'inversify'

import { TYPES } from '../../../../container/types.js'
import { ChangePasswordUseCase } from '../../application/use-cases/ChangePasswordUseCase.js'

@injectable()
export class CredentialsController {
  public constructor(
    @inject(TYPES.ChangePasswordUseCase)
    private readonly changePasswordUseCase: ChangePasswordUseCase,
  ) {}

  public async changePassword(request: Request, response: Response): Promise<void> {
    await this.changePasswordUseCase.execute({
      ...request.body,
      userId: request.user!.userId,
      accessToken: request.signedCookies.access_token,
      sessionKey: request.user!.sessionKey,
      requestId: request.requestId,
      userAgent: request.headers['user-agent'] ?? null,
      ipAddress: request.ip,
    })

    response.status(204).send()
  }
}
