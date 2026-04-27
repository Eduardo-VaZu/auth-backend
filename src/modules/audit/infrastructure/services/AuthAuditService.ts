import { inject, injectable } from 'inversify'
import type { Logger } from 'pino'

import { TYPES } from '../../../../container/types.js'
import {
  createDatabaseExecutor,
  type DatabaseExecutor,
  type DatabaseExecutorSource,
} from '../../../../infrastructure/db/db.js'
import * as schema from '../../../../infrastructure/db/schema/index.js'
import { appLogger } from '../../../../shared/logger/logger.js'
import {
  coerceUuidOrNull,
  logInvalidUuidDiscard,
} from '../../../../shared/utils/isUuid.js'
import type {
  IAuthAuditService,
  RecordAuthAuditEventParams,
} from '../../domain/services/IAuthAuditService.js'

@injectable()
export class AuthAuditService implements IAuthAuditService {
  private readonly database: DatabaseExecutor
  private readonly logger: Logger = appLogger

  public constructor(
    @inject(TYPES.DbPool)
    source: DatabaseExecutorSource,
  ) {
    this.database = createDatabaseExecutor(source)
  }

  public async recordEvent(params: RecordAuthAuditEventParams): Promise<void> {
    logInvalidUuidDiscard({
      logger: this.logger,
      component: 'AuthAuditService',
      field: 'userId',
      value: params.userId,
    })
    logInvalidUuidDiscard({
      logger: this.logger,
      component: 'AuthAuditService',
      field: 'actorUserId',
      value: params.actorUserId,
    })
    logInvalidUuidDiscard({
      logger: this.logger,
      component: 'AuthAuditService',
      field: 'sessionId',
      value: params.sessionId,
    })
    logInvalidUuidDiscard({
      logger: this.logger,
      component: 'AuthAuditService',
      field: 'roleId',
      value: params.roleId,
    })
    logInvalidUuidDiscard({
      logger: this.logger,
      component: 'AuthAuditService',
      field: 'requestId',
      value: params.requestId,
    })

    await this.database.insert(schema.authAuditLogs).values({
      userId: coerceUuidOrNull(params.userId),
      actorUserId: coerceUuidOrNull(params.actorUserId),
      sessionId: coerceUuidOrNull(params.sessionId),
      roleId: coerceUuidOrNull(params.roleId),
      eventType: params.eventType,
      eventStatus: params.eventStatus,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      requestId: coerceUuidOrNull(params.requestId),
      metadata: params.metadata ?? {},
    })
  }
}
