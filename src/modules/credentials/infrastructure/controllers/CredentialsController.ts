import type { Request, Response } from 'express'
import { inject, injectable } from 'inversify'

import { TYPES } from '../../../../container/types.js'
import {
  ACCESS_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
} from '../../../access/application/constants/auth.constants.js'
import type { ChangePasswordInputDto } from '../../../access/application/dtos/AuthDtos.js'
import {
  getClearedAccessTokenCookieOptions,
  getClearedRefreshTokenCookieOptions,
} from '../../../access/infrastructure/controllers/cookieOptions.js'
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

const clearAuthCookies = (response: Response): void => {
  response.clearCookie(
    ACCESS_TOKEN_COOKIE_NAME,
    getClearedAccessTokenCookieOptions(),
  )
  response.clearCookie(
    REFRESH_TOKEN_COOKIE_NAME,
    getClearedRefreshTokenCookieOptions(),
  )
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

    const result = await this.forgotPasswordUseCase.execute({
      email: body.email,
      requestId: request.requestId ?? null,
      userAgent: getUserAgent(request),
      ipAddress: request.ip ?? null,
    })

    response.status(200).json({
      message:
        'If the account exists, password reset instructions were generated',
      ...(result.previewToken === null
        ? {}
        : { previewToken: result.previewToken }),
    })
  }

  public async resetPassword(
    request: Request,
    response: Response,
  ): Promise<void> {
    const body = request.body as Pick<
      ResetPasswordInputDto,
      'token' | 'newPassword'
    >

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

  public async verifyEmail(
    request: Request,
    response: Response,
  ): Promise<void> {
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
    const body = request.body as Pick<ResendVerificationInputDto, 'email'>
    const input: ResendVerificationInputDto = {
      email: body.email,
      requestId: request.requestId ?? null,
      userAgent: getUserAgent(request),
      ipAddress: request.ip ?? null,
    }

    const result = await this.resendVerificationUseCase.execute(input)

    response.status(200).json({
      message: 'Verification instructions generated',
      ...(result.previewToken === null
        ? {}
        : { previewToken: result.previewToken }),
    })
  }

  public async changePassword(
    request: Request,
    response: Response,
  ): Promise<void> {
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

    clearAuthCookies(response)

    response.status(200).json({
      message: 'Password changed successfully',
    })
  }

  public async changeEmail(
    request: Request,
    response: Response,
  ): Promise<void> {
    const body = request.body as Pick<ChangeEmailInputDto, 'email'>

    const result = await this.changeEmailUseCase.execute({
      userId: request.user!.userId,
      email: body.email,
      accessToken: getSignedAccessToken(request),
      sessionKey: request.user!.sessionKey,
      requestId: request.requestId ?? null,
      userAgent: getUserAgent(request),
      ipAddress: request.ip ?? null,
    })

    clearAuthCookies(response)

    response.status(200).json({
      message: 'Email updated. Re-verify your new email to reactivate access',
      ...(result.previewToken === null
        ? {}
        : { previewToken: result.previewToken }),
    })
  }
}
