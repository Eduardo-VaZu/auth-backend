import argon2 from 'argon2'
import { randomBytes } from 'node:crypto'
import { inject, injectable } from 'inversify'

import { TYPES } from '../../../../container/types.js'
import type { ISessionStore } from '../../../access/domain/services/ISessionStore.js'
import type { ITokenService } from '../../../access/domain/services/ITokenService.js'
import { Email } from '../../../identity/domain/value-objects/Email.js'
import type { IAuthUnitOfWork } from '../../../../shared/domain/services/IAuthUnitOfWork.js'
import {
  ConflictError,
  UnauthorizedError,
} from '../../../../shared/errors/HttpErrors.js'
import type { ChangeEmailInputDto } from '../dtos/CredentialDtos.js'

const EMAIL_VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000

const isUniqueViolationError = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) {
    return false
  }

  const candidate = error as { code?: unknown }

  return candidate.code === '23505'
}

@injectable()
export class ChangeEmailUseCase {
  public constructor(
    @inject(TYPES.ITokenService)
    private readonly tokenService: ITokenService,
    @inject(TYPES.ISessionStore)
    private readonly sessionStore: ISessionStore,
    @inject(TYPES.IAuthUnitOfWork)
    private readonly authUnitOfWork: IAuthUnitOfWork,
  ) {}

  public async execute(input: ChangeEmailInputDto): Promise<void> {
    const nextEmail = new Email(input.email)
    const decodedAccessToken =
      input.accessToken === null
        ? null
        : this.tokenService.decodeAccessToken(input.accessToken)
    const revokedAt = new Date()

    await this.authUnitOfWork.run(
      async ({
        authAuditService,
        oneTimeTokenRepository,
        refreshTokenRepository,
        userRepository,
        userSessionRepository,
        acquireUserMutationLock,
      }) => {
        await acquireUserMutationLock(input.userId)

        const user = await userRepository.findById(input.userId)

        if (user === null || !user.canAuthenticate()) {
          throw new UnauthorizedError('User is no longer available')
        }

        if (user.email === nextEmail.value) {
          throw new ConflictError(
            'New email must be different from current email',
          )
        }

        const existingUser = await userRepository.findByEmail(nextEmail.value)

        if (existingUser !== null && existingUser.id !== user.id) {
          throw new ConflictError('Email is already in use')
        }

        const plainToken = randomBytes(32).toString('hex')
        const tokenHash = await argon2.hash(plainToken)
        const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_MS)

        try {
          await userRepository.updateEmailForReverification({
            userId: user.id,
            email: nextEmail.value,
            updatedAt: revokedAt,
          })
        } catch (error: unknown) {
          if (isUniqueViolationError(error)) {
            throw new ConflictError('Email is already in use')
          }

          throw error
        }
        await oneTimeTokenRepository.create({
          userId: user.id,
          type: 'email_verification',
          tokenHash,
          requestedByIp: input.ipAddress,
          expiresAt,
        })

        await userSessionRepository.revokeAllByUserId(
          user.id,
          revokedAt,
          'email_changed',
        )
        await refreshTokenRepository.revokeAllByUserId({
          userId: user.id,
          revokedAt,
          revokedReason: 'email_changed',
        })

        await authAuditService.recordEvent({
          userId: user.id,
          eventType: 'email_change_requested',
          eventStatus: 'success',
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          requestId: input.requestId,
          metadata: {
            previousEmail: user.email,
            nextEmail: nextEmail.value,
            expiresAt: expiresAt.toISOString(),
            sessionKey: input.sessionKey,
          },
        })
        await authAuditService.recordEvent({
          userId: user.id,
          eventType: 'all_sessions_revoked_after_email_change',
          eventStatus: 'success',
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          requestId: input.requestId,
          metadata: {
            sessionKey: input.sessionKey,
          },
        })
      },
    )

    await this.sessionStore.deleteAllRefreshTokens(input.userId)

    if (decodedAccessToken !== null) {
      const ttlSeconds = Math.max(
        decodedAccessToken.exp - Math.floor(Date.now() / 1000),
        0,
      )

      if (ttlSeconds > 0) {
        await this.sessionStore.blacklistAccessToken(
          decodedAccessToken.jti,
          ttlSeconds,
        )
      }
    }
  }
}
