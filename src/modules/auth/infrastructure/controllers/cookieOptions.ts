import type { CookieOptions } from 'express'

import { env } from '../../../../config/env.js'
import { durationToSeconds } from '../../application/utils/duration.js'
import { REFRESH_TOKEN_COOKIE_PATH } from '../../application/constants/auth.constants.js'

const isProduction = env.NODE_ENV === 'production'
const isLocalhostDomain = env.COOKIE_DOMAIN.trim().toLowerCase() === 'localhost'
const accessTokenMaxAgeMs =
  durationToSeconds(env.ACCESS_TOKEN_EXPIRES_IN, 'ACCESS_TOKEN_EXPIRES_IN') *
  1000
const refreshTokenMaxAgeMs =
  durationToSeconds(env.REFRESH_TOKEN_EXPIRES_IN, 'REFRESH_TOKEN_EXPIRES_IN') *
  1000

const baseCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: isProduction ? true : env.COOKIE_SECURE,
  sameSite: isProduction ? 'strict' : env.COOKIE_SAME_SITE,
  signed: true,
  ...(isLocalhostDomain ? {} : { domain: env.COOKIE_DOMAIN }),
})

export const getAccessTokenCookieOptions = (): CookieOptions => ({
  ...baseCookieOptions(),
  path: '/',
  maxAge: accessTokenMaxAgeMs,
})

export const getRefreshTokenCookieOptions = (): CookieOptions => ({
  ...baseCookieOptions(),
  path: REFRESH_TOKEN_COOKIE_PATH,
  maxAge: refreshTokenMaxAgeMs,
})

export const getClearedAccessTokenCookieOptions = (): CookieOptions => ({
  ...getAccessTokenCookieOptions(),
  expires: new Date(0),
  maxAge: 0,
})

export const getClearedRefreshTokenCookieOptions = (): CookieOptions => ({
  ...getRefreshTokenCookieOptions(),
  expires: new Date(0),
  maxAge: 0,
})
