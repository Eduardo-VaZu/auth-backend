import { inject, injectable } from 'inversify'

import { TYPES } from '../../../../container/types.js'
import {
  ConflictError,
  NotFoundError,
} from '../../../../shared/errors/HttpErrors.js'
import type { IAuthUnitOfWork } from '../../../../shared/domain/services/IAuthUnitOfWork.js'
import type { ISessionStore } from '../../../access/domain/services/ISessionStore.js'
import type { ITokenService } from '../../../access/domain/services/ITokenService.js'
import type {
  RevokeUserRoleInputDto,
  RevokeUserRoleResultDto,
} from '../dtos/AdminDtos.js'

@injectable()
export class RevokeUserRoleUseCase {
  public constructor(
    @inject(TYPES.ITokenService)
    private readonly tokenService: ITokenService,
    @inject(TYPES.ISessionStore)
    private readonly sessionStore: ISessionStore,
    @inject(TYPES.IAuthUnitOfWork)
    private readonly authUnitOfWork: IAuthUnitOfWork,
  ) {}

  public async execute(
    input: RevokeUserRoleInputDto,
  ): Promise<RevokeUserRoleResultDto> {
    const decodedAccessToken =
      input.accessToken === null
        ? null
        : this.tokenService.decodeAccessToken(input.accessToken)
    const revokedAt = new Date()

    await this.authUnitOfWork.run(
      async ({
        authAuditService,
        refreshTokenRepository,
        roleRepository,
        userRepository,
        userRoleRepository,
        userSessionRepository,
        acquireUserMutationLock,
      }) => {
        await acquireUserMutationLock(input.targetUserId)

        const targetUser = await userRepository.findById(input.targetUserId)

        if (targetUser === null) {
          throw new NotFoundError('User not found')
        }

        const role = await roleRepository.findById(input.roleId)

        if (role === null) {
          throw new NotFoundError('Role not found')
        }

        const activeRoles = await userRoleRepository.listActiveByUserId(
          input.targetUserId,
        )

        if (!activeRoles.some((activeRole) => activeRole.id === input.roleId)) {
          throw new NotFoundError('Role assignment not found')
        }

        if (activeRoles.length <= 1) {
          throw new ConflictError(
            'Cannot revoke the last active role from a user',
          )
        }

        const wasRevoked = await userRoleRepository.revokeActiveRole(
          input.targetUserId,
          input.roleId,
          revokedAt,
        )

        if (!wasRevoked) {
          throw new NotFoundError('Role assignment not found')
        }

        await userSessionRepository.revokeAllByUserId(
          input.targetUserId,
          revokedAt,
          'role_changed',
        )
        await refreshTokenRepository.revokeAllByUserId({
          userId: input.targetUserId,
          revokedAt,
          revokedReason: 'role_changed',
        })

        await authAuditService.recordEvent({
          userId: input.targetUserId,
          actorUserId: input.actorUserId,
          roleId: input.roleId,
          eventType: 'user_role_revoked',
          eventStatus: 'success',
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          requestId: input.requestId,
          metadata: {
            roleCode: role.code,
          },
        })
      },
    )

    await this.sessionStore.deleteAllRefreshTokens(input.targetUserId)

    const clearAuthCookies =
      decodedAccessToken !== null &&
      decodedAccessToken.userId === input.targetUserId

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
