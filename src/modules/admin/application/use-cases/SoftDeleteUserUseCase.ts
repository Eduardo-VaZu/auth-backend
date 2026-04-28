import { inject, injectable } from 'inversify'

import { TYPES } from '../../../../container/types.js'
import type { ISessionStore } from '../../../access/domain/services/ISessionStore.js'
import type { ITokenService } from '../../../access/domain/services/ITokenService.js'
import type { IAuthUnitOfWork } from '../../../../shared/domain/services/IAuthUnitOfWork.js'
import { NotFoundError } from '../../../../shared/errors/HttpErrors.js'
import type {
  SoftDeleteUserInputDto,
  SoftDeleteUserResultDto,
} from '../dtos/AdminDtos.js'

@injectable()
export class SoftDeleteUserUseCase {
  public constructor(
    @inject(TYPES.ITokenService)
    private readonly tokenService: ITokenService,
    @inject(TYPES.ISessionStore)
    private readonly sessionStore: ISessionStore,
    @inject(TYPES.IAuthUnitOfWork)
    private readonly authUnitOfWork: IAuthUnitOfWork,
  ) {}

  public async execute(
    input: SoftDeleteUserInputDto,
  ): Promise<SoftDeleteUserResultDto> {
    const decodedAccessToken =
      input.accessToken === null
        ? null
        : this.tokenService.decodeAccessToken(input.accessToken)
    const deletedAt = new Date()
    let deletionApplied = false

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

        deletionApplied = targetUser.deletedAt === null

        if (deletionApplied) {
          await userRepository.softDelete({
            userId: input.targetUserId,
            deletedAt,
          })
          await userSessionRepository.revokeAllByUserId(
            input.targetUserId,
            deletedAt,
            'user_soft_deleted',
          )
          await refreshTokenRepository.revokeAllByUserId({
            userId: input.targetUserId,
            revokedAt: deletedAt,
            revokedReason: 'user_soft_deleted',
          })
        }

        await authAuditService.recordEvent({
          userId: input.targetUserId,
          actorUserId: input.actorUserId,
          eventType: 'user_soft_deleted',
          eventStatus: 'success',
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          requestId: input.requestId,
          metadata: {
            alreadyDeleted: !deletionApplied,
          },
        })
      },
    )

    const clearAuthCookies =
      decodedAccessToken !== null &&
      decodedAccessToken.userId === input.targetUserId &&
      deletionApplied

    if (deletionApplied) {
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
