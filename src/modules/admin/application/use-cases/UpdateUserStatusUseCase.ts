import { inject, injectable } from 'inversify'

import { TYPES } from '../../../../container/types.js'
import type { ISessionStore } from '../../../access/domain/services/ISessionStore.js'
import type { ITokenService } from '../../../access/domain/services/ITokenService.js'
import type { IAuthUnitOfWork } from '../../../../shared/domain/services/IAuthUnitOfWork.js'
import {
  ConflictError,
  NotFoundError,
} from '../../../../shared/errors/HttpErrors.js'
import type {
  UpdateUserStatusInputDto,
  UpdateUserStatusResultDto,
} from '../dtos/AdminDtos.js'

@injectable()
export class UpdateUserStatusUseCase {
  public constructor(
    @inject(TYPES.ITokenService)
    private readonly tokenService: ITokenService,
    @inject(TYPES.ISessionStore)
    private readonly sessionStore: ISessionStore,
    @inject(TYPES.IAuthUnitOfWork)
    private readonly authUnitOfWork: IAuthUnitOfWork,
  ) {}

  public async execute(
    input: UpdateUserStatusInputDto,
  ): Promise<UpdateUserStatusResultDto> {
    const decodedAccessToken =
      input.accessToken === null
        ? null
        : this.tokenService.decodeAccessToken(input.accessToken)
    const updatedAt = new Date()
    let statusChanged = false

    await this.authUnitOfWork.run(
      async ({
        authAuditService,
        refreshTokenRepository,
        userRepository,
        userSessionRepository,
        acquireUserMutationLock,
      }) => {
        await acquireUserMutationLock(input.targetUserId)

        const targetUser = await userRepository.findById(input.targetUserId)

        if (targetUser === null) {
          throw new NotFoundError('User not found')
        }

        if (targetUser.deletedAt !== null) {
          throw new ConflictError('Cannot update status of a deleted user')
        }

        statusChanged = targetUser.status !== input.status

        if (statusChanged) {
          await userRepository.updateStatus({
            userId: input.targetUserId,
            status: input.status,
            updatedAt,
          })
          await userSessionRepository.revokeAllByUserId(
            input.targetUserId,
            updatedAt,
            'status_changed',
          )
          await refreshTokenRepository.revokeAllByUserId({
            userId: input.targetUserId,
            revokedAt: updatedAt,
            revokedReason: 'status_changed',
          })
        }

        await authAuditService.recordEvent({
          userId: input.targetUserId,
          actorUserId: input.actorUserId,
          eventType: 'user_status_updated',
          eventStatus: 'success',
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          requestId: input.requestId,
          metadata: {
            nextStatus: input.status,
            statusChanged,
          },
        })
      },
    )

    const clearAuthCookies =
      statusChanged &&
      decodedAccessToken !== null &&
      decodedAccessToken.userId === input.targetUserId

    if (statusChanged) {
      await this.sessionStore.deleteAllRefreshTokens(input.targetUserId)
    }

    if (clearAuthCookies) {
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

    return {
      clearAuthCookies,
    }
  }
}
