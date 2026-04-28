import { and, count, desc, eq, gte, lte, type SQL } from 'drizzle-orm'
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
  AuthAuditEvent,
  IAuthAuditService,
  ListAuthAuditEventsParams,
  ListAuthAuditEventsResult,
  RecordAuthAuditEventParams,
} from '../../domain/services/IAuthAuditService.js'

@injectable()
export class AuthAuditService implements IAuthAuditService {
  private readonly database: DatabaseExecutor
  private readonly logger: Logger

  public constructor(
    @inject(TYPES.DbPool)
    source: DatabaseExecutorSource,
    @inject(TYPES.Logger)
    logger: Logger = appLogger,
  ) {
    this.database = createDatabaseExecutor(source)
    this.logger = logger
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

  public async listEvents(
    params: ListAuthAuditEventsParams,
  ): Promise<ListAuthAuditEventsResult> {
    const filters: SQL<unknown>[] = []

    if (params.userId !== undefined) {
      filters.push(eq(schema.authAuditLogs.userId, params.userId))
    }

    if (params.actorUserId !== undefined) {
      filters.push(eq(schema.authAuditLogs.actorUserId, params.actorUserId))
    }

    if (params.requestId !== undefined) {
      filters.push(eq(schema.authAuditLogs.requestId, params.requestId))
    }

    if (params.eventType !== undefined) {
      filters.push(eq(schema.authAuditLogs.eventType, params.eventType))
    }

    if (params.eventStatus !== undefined) {
      filters.push(eq(schema.authAuditLogs.eventStatus, params.eventStatus))
    }

    if (params.createdFrom !== undefined) {
      filters.push(gte(schema.authAuditLogs.createdAt, params.createdFrom))
    }

    if (params.createdTo !== undefined) {
      filters.push(lte(schema.authAuditLogs.createdAt, params.createdTo))
    }

    const whereClause = filters.length === 0 ? undefined : and(...filters)
    const [totalRows, rows] = await Promise.all([
      this.database
        .select({
          count: count(),
        })
        .from(schema.authAuditLogs)
        .where(whereClause),
      this.database
        .select()
        .from(schema.authAuditLogs)
        .where(whereClause)
        .orderBy(desc(schema.authAuditLogs.createdAt))
        .limit(params.limit)
        .offset(params.offset),
    ])

    return {
      events: rows.map((row) => this.mapAuditRow(row)),
      total: totalRows[0] === undefined ? 0 : Number(totalRows[0].count),
    }
  }

  private mapAuditRow(
    row: typeof schema.authAuditLogs.$inferSelect,
  ): AuthAuditEvent {
    return {
      id: row.id,
      userId: row.userId ?? null,
      actorUserId: row.actorUserId ?? null,
      sessionId: row.sessionId ?? null,
      roleId: row.roleId ?? null,
      eventType: row.eventType,
      eventStatus: row.eventStatus as AuthAuditEvent['eventStatus'],
      ipAddress: row.ipAddress ?? null,
      userAgent: row.userAgent ?? null,
      requestId: row.requestId ?? null,
      metadata: row.metadata,
      createdAt: row.createdAt,
    }
  }
}
