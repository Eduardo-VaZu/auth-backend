import { and, asc, count, eq, gt, isNull } from 'drizzle-orm'
import { inject, injectable } from 'inversify'
import type { Logger } from 'pino'

import { TYPES } from '../../../../container/types.js'
import {
  createDatabaseExecutor,
  type DatabaseExecutor,
  type DatabaseExecutorSource,
} from '../../../../infrastructure/db/db.js'
import * as schema from '../../../../infrastructure/db/schema/index.js'
import { InternalError } from '../../../../shared/errors/HttpErrors.js'
import { appLogger } from '../../../../shared/logger/logger.js'
import { isUuid, logInvalidUuidDiscard } from '../../../../shared/utils/isUuid.js'
import { UserSession } from '../../domain/entities/UserSession.js'
import type {
  CreateUserSessionParams,
  IUserSessionRepository,
  UpdateSessionRotationParams,
} from '../../domain/repositories/IUserSessionRepository.js'

@injectable()
export class UserSessionRepository implements IUserSessionRepository {
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

  public async create(params: CreateUserSessionParams): Promise<UserSession> {
    const [session] = await this.database
      .insert(schema.userSessions)
      .values({
        userId: params.userId,
        sessionKey: params.sessionKey,
        authzVersion: params.authzVersion,
        deviceName: params.deviceName,
        deviceFingerprint: params.deviceFingerprint,
        userAgent: params.userAgent,
        ipAddress: params.ipAddress,
        lastActivityAt: params.lastActivityAt ?? new Date(),
        expiresAt: params.expiresAt,
      })
      .returning()

    if (session === undefined) {
      throw new InternalError('Failed to create user session')
    }

    return this.mapToEntity(session)
  }

  public async findBySessionKey(
    sessionKey: string,
  ): Promise<UserSession | null> {
    if (!isUuid(sessionKey)) {
      logInvalidUuidDiscard({
        logger: this.logger,
        component: 'UserSessionRepository',
        field: 'sessionKey',
        value: sessionKey,
      })
      return null
    }

    const [session] = await this.database
      .select()
      .from(schema.userSessions)
      .where(eq(schema.userSessions.sessionKey, sessionKey))

    return session === undefined ? null : this.mapToEntity(session)
  }

  public async findById(id: string): Promise<UserSession | null> {
    if (!isUuid(id)) {
      logInvalidUuidDiscard({
        logger: this.logger,
        component: 'UserSessionRepository',
        field: 'id',
        value: id,
      })
      return null
    }

    const [session] = await this.database
      .select()
      .from(schema.userSessions)
      .where(eq(schema.userSessions.id, id))

    return session === undefined ? null : this.mapToEntity(session)
  }

  public async listActiveByUserId(
    userId: string,
    referenceDate = new Date(),
  ): Promise<UserSession[]> {
    if (!isUuid(userId)) {
      logInvalidUuidDiscard({
        logger: this.logger,
        component: 'UserSessionRepository',
        field: 'userId',
        value: userId,
      })
      return []
    }

    const sessions = await this.database
      .select()
      .from(schema.userSessions)
      .where(
        and(
          eq(schema.userSessions.userId, userId),
          isNull(schema.userSessions.revokedAt),
          gt(schema.userSessions.expiresAt, referenceDate),
        ),
      )
      .orderBy(asc(schema.userSessions.createdAt))

    return sessions.map((session) => this.mapToEntity(session))
  }

  public async countActiveByUserId(
    userId: string,
    referenceDate = new Date(),
  ): Promise<number> {
    if (!isUuid(userId)) {
      logInvalidUuidDiscard({
        logger: this.logger,
        component: 'UserSessionRepository',
        field: 'userId',
        value: userId,
      })
      return 0
    }

    const [result] = await this.database
      .select({
        count: count(),
      })
      .from(schema.userSessions)
      .where(
        and(
          eq(schema.userSessions.userId, userId),
          isNull(schema.userSessions.revokedAt),
          gt(schema.userSessions.expiresAt, referenceDate),
        ),
      )

    return result === undefined ? 0 : Number(result.count)
  }

  public async findOldestActiveByUserId(
    userId: string,
    referenceDate = new Date(),
  ): Promise<UserSession | null> {
    if (!isUuid(userId)) {
      logInvalidUuidDiscard({
        logger: this.logger,
        component: 'UserSessionRepository',
        field: 'userId',
        value: userId,
      })
      return null
    }

    const [session] = await this.database
      .select()
      .from(schema.userSessions)
      .where(
        and(
          eq(schema.userSessions.userId, userId),
          isNull(schema.userSessions.revokedAt),
          gt(schema.userSessions.expiresAt, referenceDate),
        ),
      )
      .orderBy(asc(schema.userSessions.createdAt))
      .limit(1)

    return session === undefined ? null : this.mapToEntity(session)
  }

  public async rotateSession(
    params: UpdateSessionRotationParams,
  ): Promise<void> {
    if (!isUuid(params.currentSessionKey)) {
      logInvalidUuidDiscard({
        logger: this.logger,
        component: 'UserSessionRepository',
        field: 'currentSessionKey',
        value: params.currentSessionKey,
      })
      return
    }

    await this.database
      .update(schema.userSessions)
      .set({
        authzVersion: params.authzVersion,
        deviceName: params.deviceName,
        userAgent: params.userAgent,
        ipAddress: params.ipAddress,
        expiresAt: params.expiresAt,
        lastActivityAt: params.lastActivityAt ?? new Date(),
      })
      .where(eq(schema.userSessions.sessionKey, params.currentSessionKey))
  }

  public async revokeBySessionKey(
    sessionKey: string,
    revokedAt = new Date(),
    revokedReason: string | null = null,
  ): Promise<void> {
    if (!isUuid(sessionKey)) {
      logInvalidUuidDiscard({
        logger: this.logger,
        component: 'UserSessionRepository',
        field: 'sessionKey',
        value: sessionKey,
      })
      return
    }

    await this.database
      .update(schema.userSessions)
      .set({
        revokedAt,
        revokedReason,
      })
      .where(eq(schema.userSessions.sessionKey, sessionKey))
  }

  public async revokeById(
    sessionId: string,
    revokedAt = new Date(),
    revokedReason: string | null = null,
  ): Promise<void> {
    if (!isUuid(sessionId)) {
      logInvalidUuidDiscard({
        logger: this.logger,
        component: 'UserSessionRepository',
        field: 'sessionId',
        value: sessionId,
      })
      return
    }

    await this.database
      .update(schema.userSessions)
      .set({
        revokedAt,
        revokedReason,
      })
      .where(eq(schema.userSessions.id, sessionId))
  }

  public async revokeAllByUserId(
    userId: string,
    revokedAt = new Date(),
    revokedReason: string | null = null,
  ): Promise<void> {
    if (!isUuid(userId)) {
      logInvalidUuidDiscard({
        logger: this.logger,
        component: 'UserSessionRepository',
        field: 'userId',
        value: userId,
      })
      return
    }

    await this.database
      .update(schema.userSessions)
      .set({
        revokedAt,
        revokedReason,
      })
      .where(
        and(
          eq(schema.userSessions.userId, userId),
          isNull(schema.userSessions.revokedAt),
        ),
      )
  }

  private mapToEntity(
    row: typeof schema.userSessions.$inferSelect,
  ): UserSession {
    return new UserSession({
      id: row.id,
      userId: row.userId,
      sessionKey: row.sessionKey,
      authzVersion: row.authzVersion,
      deviceName: row.deviceName ?? null,
      deviceFingerprint: row.deviceFingerprint ?? null,
      userAgent: row.userAgent ?? null,
      ipAddress: row.ipAddress ?? null,
      lastActivityAt: row.lastActivityAt,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt ?? null,
      revokedReason: row.revokedReason ?? null,
      createdAt: row.createdAt,
    })
  }
}
