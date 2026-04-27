import type { Request, Response } from 'express'
import { inject, injectable } from 'inversify'

import { TYPES } from '../../../../container/types.js'
import {
  ACCESS_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
} from '../../application/constants/auth.constants.js'
import type {
  LoginInputDto,
  LogoutAllInputDto,
  LogoutInputDto,
  RefreshTokenInputDto,
} from '../../application/dtos/AuthDtos.js'
import { LoginUseCase } from '../../application/use-cases/LoginUseCase.js'
import { LogoutAllUseCase } from '../../application/use-cases/LogoutAllUseCase.js'
import { LogoutUseCase } from '../../application/use-cases/LogoutUseCase.js'
import { RefreshTokenUseCase } from '../../application/use-cases/RefreshTokenUseCase.js'
import { UnauthorizedError } from '../../../../shared/errors/HttpErrors.js'
import {
  getAccessTokenCookieOptions,
  getClearedAccessTokenCookieOptions,
  getClearedRefreshTokenCookieOptions,
  getRefreshTokenCookieOptions,
} from './cookieOptions.js'

const getRequestIp = (request: Request): string | null => request.ip ?? null

const getRequestUserAgent = (request: Request): string | null =>
  request.get('user-agent') ?? null

const getSignedCookie = (
  request: Request,
  cookieName: string,
): string | null => {
  const cookieValue = (request.signedCookies as Record<string, unknown>)[
    cookieName
  ]

  return typeof cookieValue === 'string' ? cookieValue : null
}

@injectable()
export class AccessController {
  public constructor(
    @inject(TYPES.LoginUseCase)
    private readonly loginUseCase: LoginUseCase,
    @inject(TYPES.RefreshTokenUseCase)
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    @inject(TYPES.LogoutUseCase)
    private readonly logoutUseCase: LogoutUseCase,
    @inject(TYPES.LogoutAllUseCase)
    private readonly logoutAllUseCase: LogoutAllUseCase,
  ) {}

  public async login(request: Request, response: Response): Promise<void> {
    const body = request.body as LoginInputDto
    const result = await this.loginUseCase.execute({
      email: body.email,
      password: body.password,
      userAgent: getRequestUserAgent(request),
      ipAddress: getRequestIp(request),
      requestId: request.requestId ?? null,
    })

    response.cookie(
      ACCESS_TOKEN_COOKIE_NAME,
      result.accessToken,
      getAccessTokenCookieOptions(),
    )
    response.cookie(
      REFRESH_TOKEN_COOKIE_NAME,
      result.refreshToken,
      getRefreshTokenCookieOptions(),
    )

    response.status(200).json({
      user: result.user,
    })
  }

  public async refresh(request: Request, response: Response): Promise<void> {
    const refreshToken = getSignedCookie(request, REFRESH_TOKEN_COOKIE_NAME)

    if (refreshToken === null) {
      throw new UnauthorizedError('Missing refresh token')
    }

    const input: RefreshTokenInputDto = {
      refreshToken,
      userAgent: getRequestUserAgent(request),
      ipAddress: getRequestIp(request),
      requestId: request.requestId ?? null,
    }
    const result = await this.refreshTokenUseCase.execute(input)

    response.cookie(
      ACCESS_TOKEN_COOKIE_NAME,
      result.accessToken,
      getAccessTokenCookieOptions(),
    )
    response.cookie(
      REFRESH_TOKEN_COOKIE_NAME,
      result.refreshToken,
      getRefreshTokenCookieOptions(),
    )

    response.status(200).json({
      message: 'Session refreshed',
    })
  }

  public async logout(request: Request, response: Response): Promise<void> {
    const accessToken = getSignedCookie(request, ACCESS_TOKEN_COOKIE_NAME)
    const input: LogoutInputDto = {
      accessToken,
      refreshToken: getSignedCookie(request, REFRESH_TOKEN_COOKIE_NAME),
      userId: request.user?.userId ?? null,
      sessionKey: request.user?.sessionKey ?? null,
      requestId: request.requestId ?? null,
      userAgent: getRequestUserAgent(request),
      ipAddress: getRequestIp(request),
    }

    await this.logoutUseCase.execute(input)

    response.clearCookie(
      ACCESS_TOKEN_COOKIE_NAME,
      getClearedAccessTokenCookieOptions(),
    )
    response.clearCookie(
      REFRESH_TOKEN_COOKIE_NAME,
      getClearedRefreshTokenCookieOptions(),
    )

    response.status(200).json({
      message: 'Logged out successfully',
    })
  }

  public async logoutAll(request: Request, response: Response): Promise<void> {
    if (request.user === undefined) {
      throw new UnauthorizedError('Missing authenticated user')
    }

    const input: LogoutAllInputDto = {
      accessToken: getSignedCookie(request, ACCESS_TOKEN_COOKIE_NAME),
      userId: request.user.userId,
      sessionKey: request.user.sessionKey,
      requestId: request.requestId ?? null,
      userAgent: getRequestUserAgent(request),
      ipAddress: getRequestIp(request),
    }

    await this.logoutAllUseCase.execute(input)

    response.clearCookie(
      ACCESS_TOKEN_COOKIE_NAME,
      getClearedAccessTokenCookieOptions(),
    )
    response.clearCookie(
      REFRESH_TOKEN_COOKIE_NAME,
      getClearedRefreshTokenCookieOptions(),
    )

    response.status(200).json({
      message: 'Logged out from all sessions successfully',
    })
  }
}
