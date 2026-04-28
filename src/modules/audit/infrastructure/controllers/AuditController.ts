import type { Request, Response } from 'express'
import { inject, injectable } from 'inversify'

import { TYPES } from '../../../../container/types.js'
import { ValidationError } from '../../../../shared/errors/HttpErrors.js'
import { ListAuditLogsUseCase } from '../../application/use-cases/ListAuditLogsUseCase.js'
import { listAuditLogsQuerySchema } from '../routes/audit.schemas.js'

const mapValidationIssues = (
  issues: Array<{ path: Array<string | number>; message: string }>,
) =>
  issues.map((issue) => ({
    field: issue.path.join('.') || 'query',
    message: issue.message,
  }))

@injectable()
export class AuditController {
  public constructor(
    @inject(TYPES.ListAuditLogsUseCase)
    private readonly listAuditLogsUseCase: ListAuditLogsUseCase,
  ) {}

  public async listLogs(request: Request, response: Response): Promise<void> {
    const query = listAuditLogsQuerySchema.safeParse(request.query)

    if (!query.success) {
      throw new ValidationError(mapValidationIssues(query.error.issues))
    }

    const result = await this.listAuditLogsUseCase.execute({
      page: query.data.page,
      limit: query.data.limit,
      ...(query.data.userId !== undefined ? { userId: query.data.userId } : {}),
      ...(query.data.actorUserId !== undefined
        ? { actorUserId: query.data.actorUserId }
        : {}),
      ...(query.data.requestId !== undefined
        ? { requestId: query.data.requestId }
        : {}),
      ...(query.data.eventType !== undefined
        ? { eventType: query.data.eventType }
        : {}),
      ...(query.data.eventStatus !== undefined
        ? { eventStatus: query.data.eventStatus }
        : {}),
      ...(query.data.from !== undefined ? { from: query.data.from } : {}),
      ...(query.data.to !== undefined ? { to: query.data.to } : {}),
    })

    response.status(200).json(result)
  }
}
