import { inject, injectable } from 'inversify'

import { TYPES } from '../../../../container/types.js'
import type { IAuthAuditService } from '../../domain/services/IAuthAuditService.js'
import type {
  ListAuditLogsInputDto,
  ListAuditLogsResultDto,
} from '../dtos/AuditDtos.js'

@injectable()
export class ListAuditLogsUseCase {
  public constructor(
    @inject(TYPES.IAuthAuditService)
    private readonly authAuditService: IAuthAuditService,
  ) {}

  public async execute(
    input: ListAuditLogsInputDto,
  ): Promise<ListAuditLogsResultDto> {
    const offset = (input.page - 1) * input.limit
    const { events, total } = await this.authAuditService.listEvents({
      limit: input.limit,
      offset,
      ...(input.userId !== undefined ? { userId: input.userId } : {}),
      ...(input.actorUserId !== undefined
        ? { actorUserId: input.actorUserId }
        : {}),
      ...(input.requestId !== undefined ? { requestId: input.requestId } : {}),
      ...(input.eventType !== undefined ? { eventType: input.eventType } : {}),
      ...(input.eventStatus !== undefined
        ? { eventStatus: input.eventStatus }
        : {}),
      ...(input.from !== undefined ? { createdFrom: input.from } : {}),
      ...(input.to !== undefined ? { createdTo: input.to } : {}),
    })

    return {
      logs: events.map((event) => ({
        id: event.id,
        userId: event.userId,
        actorUserId: event.actorUserId,
        sessionId: event.sessionId,
        roleId: event.roleId,
        eventType: event.eventType,
        eventStatus: event.eventStatus,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        requestId: event.requestId,
        metadata: event.metadata,
        createdAt: event.createdAt.toISOString(),
      })),
      pagination: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.max(Math.ceil(total / input.limit), 1),
      },
    }
  }
}
