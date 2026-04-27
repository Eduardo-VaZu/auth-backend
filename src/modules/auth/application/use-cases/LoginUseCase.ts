import argon2 from 'argon2'
import { randomUUID } from 'node:crypto'
import { inject, injectable } from 'inversify'

import { env } from '../../../../config/env.js'
import { TYPES } from '../../../../container/types.js'
import {
  TooManyRequestsError,
  UnauthorizedError,
} from '../../../../shared/errors/HttpErrors.js'
import type { IUserCredentialRepository } from '../../domain/repositories/IUserCredentialRepository.js'
import type { IUserRepository } from '../../domain/repositories/IUserRepository.js'
import type { IAuthAuditService } from '../../domain/services/IAuthAuditService.js'
import type { IAuthUnitOfWork } from '../../domain/services/IAuthUnitOfWork.js'
import type { ISessionStore } from '../../domain/services/ISessionStore.js'
import type { ISecurityThrottleService } from '../../domain/services/ISecurityThrottleService.js'
import type { ITokenService } from '../../domain/services/ITokenService.js'
import { Email } from '../../domain/value-objects/Email.js'
import type { LoginInputDto, LoginResultDto } from '../dtos/AuthDtos.js'
import { toAuthUserDto } from '../dtos/AuthDtos.js'

const INVALID_CREDENTIALS_MESSAGE = 'Invalid credentials'
const TOO_MANY_ATTEMPTS_MESSAGE = 'Too many login attempts. Try again later.'

const getDeviceName = (userAgent: string | null): string | null =>
  userAgent === null ? null : userAgent.slice(0, 255)

@injectable()
export class LoginUseCase {
  public constructor(
    @inject(TYPES.IUserRepository)
    private readonly userRepository: IUserRepository,
    @inject(TYPES.IUserCredentialRepository)
    private readonly userCredentialRepository: IUserCredentialRepository,
    @inject(TYPES.ITokenService)
    private readonly tokenService: ITokenService,
    @inject(TYPES.ISessionStore)
    private readonly sessionStore: ISessionStore,
    @inject(TYPES.IAuthAuditService)
    private readonly authAuditService: IAuthAuditService,
    @inject(TYPES.IAuthUnitOfWork)
    private readonly authUnitOfWork: IAuthUnitOfWork,
    @inject(TYPES.ISecurityThrottleService)
    private readonly securityThrottleService: ISecurityThrottleService,
  ) {}

  public async execute(input: LoginInputDto): Promise<LoginResultDto> {
    const email = new Email(input.email)
    const throttleStatus = await this.securityThrottleService.checkLoginAllowed(
      email.value,
      input.ipAddress,
    )

    if (throttleStatus.accountLocked || throttleStatus.ipLocked) {
      await this.recordThrottleBlockedEvents(email.value, input, throttleStatus)
      throw new TooManyRequestsError(TOO_MANY_ATTEMPTS_MESSAGE)
    }

    const user = await this.userRepository.findByEmail(email.value)

    if (!user?.canAuthenticate()) {
      await argon2.hash(input.password)
      await this.recordFailedLogin(
        user?.id ?? null,
        user === null ? 'unknown_user' : 'inactive_user',
        email.value,
        input,
      )
      throw new UnauthorizedError(INVALID_CREDENTIALS_MESSAGE)
    }

    const credential = await this.userCredentialRepository.findByUserId(user.id)

    if (credential === null) {
      await argon2.hash(input.password)
      await this.recordFailedLogin(
        user.id,
        'missing_credential',
        email.value,
        input,
      )
      throw new UnauthorizedError(INVALID_CREDENTIALS_MESSAGE)
    }

    const isPasswordValid = await argon2.verify(
      credential.passwordHash,
      input.password,
    )

    if (!isPasswordValid) {
      await this.recordFailedLogin(
        user.id,
        'invalid_password',
        email.value,
        input,
      )
      throw new UnauthorizedError(INVALID_CREDENTIALS_MESSAGE)
    }

    const hadSecurityState =
      await this.securityThrottleService.clearAccountLoginFailures(email.value)

    const sessionKey = randomUUID()
    const refreshToken = await this.tokenService.generateRefreshToken({
      userId: user.id,
    })
    const accessToken = await this.tokenService.generateAccessToken({
      userId: user.id,
      roles: user.roles,
      authzVersion: user.authzVersion,
      sessionKey,
    })
    const refreshTokenHash = await argon2.hash(refreshToken.token)
    let revokedRefreshTokenJti: string | null = null

    await this.authUnitOfWork.run(
      async ({
        authAuditService,
        refreshTokenRepository,
        userRepository,
        userSessionRepository,
        acquireUserMutationLock,
      }) => {
        await acquireUserMutationLock(user.id)

        const activeSessions = await userSessionRepository.countActiveByUserId(
          user.id,
        )

        if (activeSessions >= env.MAX_SESSIONS_PER_USER) {
          const oldestSession =
            await userSessionRepository.findOldestActiveByUserId(user.id)

          if (oldestSession !== null) {
            const revokedRefreshToken =
              await refreshTokenRepository.findLatestActiveBySessionId(
                oldestSession.id,
              )

            revokedRefreshTokenJti = revokedRefreshToken?.jti ?? null

            await userSessionRepository.revokeBySessionKey(
              oldestSession.sessionKey,
              new Date(),
              'session_limit_exceeded',
            )
            await refreshTokenRepository.revokeAllBySessionId(
              oldestSession.id,
              new Date(),
              'session_limit_exceeded',
            )
          }
        }

        const session = await userSessionRepository.create({
          userId: user.id,
          sessionKey,
          authzVersion: user.authzVersion,
          deviceName: getDeviceName(input.userAgent),
          deviceFingerprint: null,
          userAgent: input.userAgent,
          ipAddress: input.ipAddress,
          expiresAt: refreshToken.expiresAt,
        })
        await refreshTokenRepository.create({
          jti: refreshToken.jti,
          sessionId: session.id,
          tokenHash: refreshTokenHash,
          expiresAt: refreshToken.expiresAt,
          userAgent: input.userAgent,
          ipAddress: input.ipAddress,
        })
        await userRepository.updateLastLoginAt(user.id)

        await authAuditService.recordEvent({
          userId: user.id,
          eventType: 'login_success',
          eventStatus: 'success',
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          requestId: input.requestId,
          metadata: {
            sessionId: session.id,
            sessionKey,
          },
        })

        if (hadSecurityState) {
          await authAuditService.recordEvent({
            userId: user.id,
            eventType: 'lock_cleared_after_successful_login',
            eventStatus: 'success',
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
            requestId: input.requestId,
            metadata: {
              identifier: email.value,
            },
          })
        }
      },
    )

    try {
      await this.sessionStore.storeRefreshToken(
        user.id,
        refreshToken.jti,
        refreshToken.ttlSeconds,
      )

      if (revokedRefreshTokenJti !== null) {
        await this.sessionStore.deleteRefreshToken(
          user.id,
          revokedRefreshTokenJti,
        )
      }
    } catch (error: unknown) {
      await this.authUnitOfWork.run(
        async ({
          refreshTokenRepository,
          userSessionRepository,
          acquireUserMutationLock,
        }) => {
          await acquireUserMutationLock(user.id)

          await refreshTokenRepository.revokeByJti({
            jti: refreshToken.jti,
            revokedReason: 'redis_session_store_failed',
          })
          await userSessionRepository.revokeBySessionKey(
            sessionKey,
            new Date(),
            'redis_session_store_failed',
          )
        },
      )

      throw error
    }

    return {
      user: toAuthUserDto(user),
      accessToken: accessToken.token,
      refreshToken: refreshToken.token,
    }
  }

  private async recordThrottleBlockedEvents(
    identifier: string,
    input: LoginInputDto,
    throttleStatus: {
      accountLocked: boolean
      ipLocked: boolean
      accountTtlSeconds: number
      ipTtlSeconds: number
    },
  ): Promise<void> {
    const events: Promise<void>[] = []

    if (throttleStatus.ipLocked) {
      events.push(
        this.authAuditService.recordEvent({
          userId: null,
          eventType: 'login_rate_limited_ip',
          eventStatus: 'blocked',
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          requestId: input.requestId,
          metadata: {
            identifier,
            ttlSeconds: throttleStatus.ipTtlSeconds,
          },
        }),
      )
    }

    if (throttleStatus.accountLocked) {
      events.push(
        this.authAuditService.recordEvent({
          userId: null,
          eventType: 'login_rate_limited_account',
          eventStatus: 'blocked',
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          requestId: input.requestId,
          metadata: {
            identifier,
            ttlSeconds: throttleStatus.accountTtlSeconds,
          },
        }),
      )
    }

    await Promise.all(events)
  }

  private async recordFailedLogin(
    userId: string | null,
    reason:
      | 'unknown_user'
      | 'inactive_user'
      | 'missing_credential'
      | 'invalid_password',
    identifier: string,
    input: LoginInputDto,
  ): Promise<void> {
    const failureResult = await this.securityThrottleService.recordLoginFailure(
      identifier,
      input.ipAddress,
    )

    const events: Promise<void>[] = [
      this.authAuditService.recordEvent({
        userId,
        eventType: 'login_failed',
        eventStatus: 'failure',
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        requestId: input.requestId,
        metadata: {
          identifier,
          reason,
        },
      }),
      this.authAuditService.recordEvent({
        userId,
        eventType:
          reason === 'invalid_password'
            ? 'login_failed_invalid_password'
            : 'login_failed_unknown_user',
        eventStatus: 'failure',
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        requestId: input.requestId,
        metadata: {
          identifier,
          reason,
        },
      }),
      this.authAuditService.recordEvent({
        userId,
        eventType: 'user_enumeration_blocked',
        eventStatus: 'blocked',
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        requestId: input.requestId,
        metadata: {
          identifier,
          reason,
        },
      }),
    ]

    if (failureResult.passwordSprayingDetected) {
      events.push(
        this.authAuditService.recordEvent({
          userId,
          eventType: 'password_spraying_detected',
          eventStatus: 'incident',
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          requestId: input.requestId,
          metadata: {
            identifier,
            distinctAccountsFromIp: failureResult.distinctAccountsFromIp,
          },
        }),
      )
    }

    if (failureResult.accountLocked) {
      events.push(
        this.authAuditService.recordEvent({
          userId,
          eventType: 'account_temporarily_locked',
          eventStatus: 'blocked',
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          requestId: input.requestId,
          metadata: {
            identifier,
            attempts: failureResult.accountAttempts,
            ttlSeconds: failureResult.accountLockTtlSeconds,
          },
        }),
      )
    }

    if (failureResult.ipLocked) {
      events.push(
        this.authAuditService.recordEvent({
          userId,
          eventType: 'ip_temporarily_locked',
          eventStatus: 'blocked',
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          requestId: input.requestId,
          metadata: {
            identifier,
            attempts: failureResult.ipAttempts,
            ttlSeconds: failureResult.ipLockTtlSeconds,
          },
        }),
      )
    }

    await Promise.all(events)
  }
}
