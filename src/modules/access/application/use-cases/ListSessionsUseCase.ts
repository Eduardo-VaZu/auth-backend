import { inject, injectable } from 'inversify'

import { TYPES } from '../../../../container/types.js'
import type { IUserSessionRepository } from '../../domain/repositories/IUserSessionRepository.js'
import type { SessionsResultDto } from '../dtos/AuthDtos.js'

@injectable()
export class ListSessionsUseCase {
  public constructor(
    @inject(TYPES.IUserSessionRepository)
    private readonly userSessionRepository: IUserSessionRepository,
  ) {}

  public async execute(
    userId: string,
    currentSessionKey: string | null,
  ): Promise<SessionsResultDto> {
    const sessions = await this.userSessionRepository.listActiveByUserId(userId)

    return {
      sessions: sessions.map((session) => ({
        id: session.id,
        deviceName: session.deviceName,
        userAgent: session.userAgent,
        ipAddress: session.ipAddress,
        lastActivityAt: session.lastActivityAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
        createdAt: session.createdAt.toISOString(),
        isCurrent:
          currentSessionKey !== null &&
          session.sessionKey === currentSessionKey,
      })),
    }
  }
}
