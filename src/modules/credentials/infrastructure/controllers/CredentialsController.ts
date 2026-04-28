import type { Request, Response } from 'express'
import { inject, injectable } from 'inversify'

import { TYPES } from '../../../../container/types.js'
import { ACCESS_TOKEN_COOKIE_NAME } from '../../../access/application/constants/auth.constants.js'
import type { ChangePasswordInputDto } from '../../../access/application/dtos/AuthDtos.js'
import type {
  ChangeEmailInputDto,
  ForgotPasswordInputDto,
  ResendVerificationInputDto,
  ResetPasswordInputDto,
  VerifyEmailInputDto,
} from '../../application/dtos/CredentialDtos.js'
import { ForgotPasswordUseCase } from '../../application/use-cases/ForgotPasswordUseCase.js'
import { ResendVerificationUseCase } from '../../application/use-cases/ResendVerificationUseCase.js'
import { ResetPasswordUseCase } from '../../application/use-cases/ResetPasswordUseCase.js'
import { VerifyEmailUseCase } from '../../application/use-cases/VerifyEmailUseCase.js'
import { ChangePasswordUseCase } from '../../application/use-cases/ChangePasswordUseCase.js'
import { ChangeEmailUseCase } from '../../application/use-cases/ChangeEmailUseCase.js'

const getSignedAccessToken = (request: Request): string | null => {
  const cookieValue = (request.signedCookies as Record<string, unknown>)[
    ACCESS_TOKEN_COOKIE_NAME
  ]

  return typeof cookieValue === 'string' ? cookieValue : null
}

const getUserAgent = (request: Request): string | null => {
  const userAgent = request.headers['user-agent']

  return typeof userAgent === 'string' ? userAgent : null
}

@injectable()
export class CredentialsController {
  public constructor(
    @inject(TYPES.ForgotPasswordUseCase)
    private readonly forgotPasswordUseCase: ForgotPasswordUseCase,
    @inject(TYPES.ResetPasswordUseCase)
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
    @inject(TYPES.VerifyEmailUseCase)
    private readonly verifyEmailUseCase: VerifyEmailUseCase,
    @inject(TYPES.ResendVerificationUseCase)
    private readonly resendVerificationUseCase: ResendVerificationUseCase,
    @inject(TYPES.ChangePasswordUseCase)
    private readonly changePasswordUseCase: ChangePasswordUseCase,
    @inject(TYPES.ChangeEmailUseCase)
    private readonly changeEmailUseCase: ChangeEmailUseCase,
  ) {}

  public async forgotPassword(
    request: Request,
    response: Response,
  ): Promise<void> {
    const body = request.body as Pick<ForgotPasswordInputDto, 'email'>

    await this.forgotPasswordUseCase.execute({
      email: body.email,
      requestId: request.requestId ?? null,
      userAgent: getUserAgent(request),
      ipAddress: request.ip ?? null,
    })

    response.status(200).json({
      message:
        'If the account exists, password reset instructions were generated',
    })
  }

  public async resetPassword(
    request: Request,
    response: Response,
  ): Promise<void> {
    const body = request.body as Pick<ResetPasswordInputDto, 'token' | 'newPassword'>

    await this.resetPasswordUseCase.execute({
      token: body.token,
      newPassword: body.newPassword,
      requestId: request.requestId ?? null,
      userAgent: getUserAgent(request),
      ipAddress: request.ip ?? null,
    })

    response.status(200).json({
      message: 'Password reset successfully',
    })
  }

  public async verifyEmail(request: Request, response: Response): Promise<void> {
    const body = request.body as Pick<VerifyEmailInputDto, 'token'>

    await this.verifyEmailUseCase.execute({
      token: body.token,
      requestId: request.requestId ?? null,
      userAgent: getUserAgent(request),
      ipAddress: request.ip ?? null,
    })

    response.status(200).json({
      message: 'Email verified successfully',
    })
  }

  public async resendVerification(
    request: Request,
    response: Response,
  ): Promise<void> {
    const input: ResendVerificationInputDto = {
      userId: request.user!.userId,
      requestId: request.requestId ?? null,
      userAgent: getUserAgent(request),
      ipAddress: request.ip ?? null,
    }

    await this.resendVerificationUseCase.execute(input)

    response.status(200).json({
      message: 'Verification instructions generated',
    })
  }

  public async changePassword(request: Request, response: Response): Promise<void> {
    const body = request.body as Pick<
      ChangePasswordInputDto,
      'currentPassword' | 'newPassword'
    >

    await this.changePasswordUseCase.execute({
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
      userId: request.user!.userId,
      accessToken: getSignedAccessToken(request),
      sessionKey: request.user!.sessionKey,
      requestId: request.requestId ?? null,
      userAgent: getUserAgent(request),
      ipAddress: request.ip ?? null,
    })

    response.status(200).json({
      message: 'Password changed successfully',
    })
  }

  public async changeEmail(request: Request, response: Response): Promise<void> {
    const body = request.body as Pick<ChangeEmailInputDto, 'email'>

    await this.changeEmailUseCase.execute({
      userId: request.user!.userId,
      email: body.email,
      accessToken: getSignedAccessToken(request),
      sessionKey: request.user!.sessionKey,
      requestId: request.requestId ?? null,
      userAgent: getUserAgent(request),
      ipAddress: request.ip ?? null,
    })

    response.status(200).json({
      message: 'Email updated. Re-verify your new email to reactivate access',
    })
  }
}
