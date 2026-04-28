import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  isNotNull,
  isNull,
  lt,
} from 'drizzle-orm'
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
import {
  isUuid,
  logInvalidUuidDiscard,
} from '../../../../shared/utils/isUuid.js'
import {
  RefreshToken,
  type RefreshTokenProps,
} from '../../domain/entities/RefreshToken.js'
import type {
  CreateRefreshTokenParams,
  IRefreshTokenRepository,
  RevokeAllRefreshTokensParams,
  RevokeActiveRefreshTokenParams,
  RevokeRefreshTokenParams,
} from '../../domain/repositories/IRefreshTokenRepository.js'

@injectable()
export class RefreshTokenRepository implements IRefreshTokenRepository {
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

  public async create(params: CreateRefreshTokenParams): Promise<RefreshToken> {
    const [refreshToken] = await this.database
      .insert(schema.refreshTokens)
      .values({
        jti: params.jti,
        userId: params.userId,
        sessionId: params.sessionId,
        tokenHash: params.tokenHash,
        expiresAt: params.expiresAt,
        userAgent: params.userAgent,
        ipAddress: params.ipAddress,
      })
      .returning()

    if (refreshToken === undefined) {
      throw new InternalError('Failed to persist refresh token')
    }

    return this.mapToEntity(refreshToken)
  }

  public async findByJti(jti: string): Promise<RefreshToken | null> {
    if (!isUuid(jti)) {
      logInvalidUuidDiscard({
        logger: this.logger,
        component: 'RefreshTokenRepository',
        field: 'jti',
        value: jti,
      })
      return null
    }

    const [refreshToken] = await this.database
      .select()
      .from(schema.refreshTokens)
      .where(eq(schema.refreshTokens.jti, jti))

    return refreshToken === undefined ? null : this.mapToEntity(refreshToken)
  }

  public async findById(id: string): Promise<RefreshToken | null> {
    if (!isUuid(id)) {
      logInvalidUuidDiscard({
        logger: this.logger,
        component: 'RefreshTokenRepository',
        field: 'id',
        value: id,
      })
      return null
    }

    const [refreshToken] = await this.database
      .select()
      .from(schema.refreshTokens)
      .where(eq(schema.refreshTokens.id, id))

    return refreshToken === undefined ? null : this.mapToEntity(refreshToken)
  }

  public async revokeByJti(params: RevokeRefreshTokenParams): Promise<void> {
    if (!isUuid(params.jti)) {
      logInvalidUuidDiscard({
        logger: this.logger,
        component: 'RefreshTokenRepository',
        field: 'jti',
        value: params.jti,
      })
      return
    }

    const values: Partial<typeof schema.refreshTokens.$inferInsert> = {
      revokedAt: params.revokedAt ?? new Date(),
    }

    if (params.revokedReason !== undefined) {
      values.revokedReason = params.revokedReason
    }

    if (params.replacedByTokenId !== undefined) {
      values.replacedByTokenId = params.replacedByTokenId
    }

    if (params.lastUsedAt !== undefined) {
      values.lastUsedAt = params.lastUsedAt
    }

    await this.database
      .update(schema.refreshTokens)
      .set(values)
      .where(eq(schema.refreshTokens.jti, params.jti))
  }

  public async revokeActiveByJti(
    params: RevokeActiveRefreshTokenParams,
  ): Promise<RefreshToken | null> {
    if (!isUuid(params.jti)) {
      logInvalidUuidDiscard({
        logger: this.logger,
        component: 'RefreshTokenRepository',
        field: 'jti',
        value: params.jti,
      })
      return null
    }

    const [refreshToken] = await this.database
      .update(schema.refreshTokens)
      .set({
        revokedAt: params.revokedAt,
        revokedReason: params.revokedReason,
        replacedByTokenId: params.replacedByTokenId,
        lastUsedAt: params.lastUsedAt,
      })
      .where(
        and(
          eq(schema.refreshTokens.jti, params.jti),
          isNull(schema.refreshTokens.revokedAt),
          isNull(schema.refreshTokens.replacedByTokenId),
          gt(schema.refreshTokens.expiresAt, params.referenceDate),
        ),
      )
      .returning()

    return refreshToken === undefined ? null : this.mapToEntity(refreshToken)
  }

  public async revokeAllByUserId(
    params: RevokeAllRefreshTokensParams,
  ): Promise<void> {
    if (!isUuid(params.userId)) {
      logInvalidUuidDiscard({
        logger: this.logger,
        component: 'RefreshTokenRepository',
        field: 'userId',
        value: params.userId,
      })
      return
    }

    const values: Partial<typeof schema.refreshTokens.$inferInsert> = {
      revokedAt: params.revokedAt ?? new Date(),
    }

    if (params.revokedReason !== undefined) {
      values.revokedReason = params.revokedReason
    }

    await this.database
      .update(schema.refreshTokens)
      .set(values)
      .where(
        and(
          eq(schema.refreshTokens.userId, params.userId),
          isNull(schema.refreshTokens.revokedAt),
        ),
      )
  }

  public async updateLastUsedAt(
    jti: string,
    lastUsedAt = new Date(),
  ): Promise<void> {
    if (!isUuid(jti)) {
      logInvalidUuidDiscard({
        logger: this.logger,
        component: 'RefreshTokenRepository',
        field: 'jti',
        value: jti,
      })
      return
    }

    await this.database
      .update(schema.refreshTokens)
      .set({
        lastUsedAt,
      })
      .where(eq(schema.refreshTokens.jti, jti))
  }

  public async deleteExpired(referenceDate = new Date()): Promise<number> {
    const deletedTokens = await this.database
      .delete(schema.refreshTokens)
      .where(
        and(
          lt(schema.refreshTokens.expiresAt, referenceDate),
          isNotNull(schema.refreshTokens.revokedAt),
        ),
      )
      .returning({
        id: schema.refreshTokens.id,
      })

    return deletedTokens.length
  }

  public async countActiveSessions(
    userId: string,
    referenceDate = new Date(),
  ): Promise<number> {
    if (!isUuid(userId)) {
      logInvalidUuidDiscard({
        logger: this.logger,
        component: 'RefreshTokenRepository',
        field: 'userId',
        value: userId,
      })
      return 0
    }

    const [result] = await this.database
      .select({
        count: count(),
      })
      .from(schema.refreshTokens)
      .where(
        and(
          eq(schema.refreshTokens.userId, userId),
          isNull(schema.refreshTokens.revokedAt),
          gt(schema.refreshTokens.expiresAt, referenceDate),
        ),
      )

    if (result === undefined) {
      return 0
    }

    return Number(result.count)
  }

  public async findOldestActiveByUserId(
    userId: string,
    referenceDate = new Date(),
  ): Promise<RefreshToken | null> {
    if (!isUuid(userId)) {
      logInvalidUuidDiscard({
        logger: this.logger,
        component: 'RefreshTokenRepository',
        field: 'userId',
        value: userId,
      })
      return null
    }

    const [refreshToken] = await this.database
      .select({
        refreshToken: schema.refreshTokens,
      })
      .from(schema.refreshTokens)
      .where(
        and(
          eq(schema.refreshTokens.userId, userId),
          isNull(schema.refreshTokens.revokedAt),
          gt(schema.refreshTokens.expiresAt, referenceDate),
        ),
      )
      .orderBy(asc(schema.refreshTokens.createdAt))
      .limit(1)

    return refreshToken === undefined
      ? null
      : this.mapToEntity(refreshToken.refreshToken)
  }

  public async revokeAllBySessionId(
    sessionId: string,
    revokedAt = new Date(),
    revokedReason: string | null = null,
  ): Promise<void> {
    if (!isUuid(sessionId)) {
      logInvalidUuidDiscard({
        logger: this.logger,
        component: 'RefreshTokenRepository',
        field: 'sessionId',
        value: sessionId,
      })
      return
    }

    await this.database
      .update(schema.refreshTokens)
      .set({
        revokedAt,
        revokedReason,
      })
      .where(
        and(
          eq(schema.refreshTokens.sessionId, sessionId),
          isNull(schema.refreshTokens.revokedAt),
        ),
      )
  }

  public async findLatestActiveBySessionId(
    sessionId: string,
    referenceDate = new Date(),
  ): Promise<RefreshToken | null> {
    if (!isUuid(sessionId)) {
      logInvalidUuidDiscard({
        logger: this.logger,
        component: 'RefreshTokenRepository',
        field: 'sessionId',
        value: sessionId,
      })
      return null
    }

    const [refreshToken] = await this.database
      .select()
      .from(schema.refreshTokens)
      .where(
        and(
          eq(schema.refreshTokens.sessionId, sessionId),
          isNull(schema.refreshTokens.revokedAt),
          gt(schema.refreshTokens.expiresAt, referenceDate),
        ),
      )
      .orderBy(desc(schema.refreshTokens.createdAt))
      .limit(1)

    return refreshToken === undefined ? null : this.mapToEntity(refreshToken)
  }

  private mapToEntity(
    row: typeof schema.refreshTokens.$inferSelect,
  ): RefreshToken {
    const props: RefreshTokenProps = {
      id: row.id,
      jti: row.jti,
      userId: row.userId,
      sessionId: row.sessionId,
      tokenHash: row.tokenHash,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt ?? null,
      replacedByTokenId: row.replacedByTokenId ?? null,
      revokedReason: row.revokedReason ?? null,
      lastUsedAt: row.lastUsedAt ?? null,
      createdAt: row.createdAt,
      userAgent: row.userAgent ?? null,
      ipAddress: row.ipAddress ?? null,
    }

    return new RefreshToken(props)
  }
}
