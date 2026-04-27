import { and, eq, gt, isNull } from 'drizzle-orm'
import { inject, injectable } from 'inversify'

import { TYPES } from '../../../../container/types.js'
import {
  createDatabaseExecutor,
  type DatabaseExecutor,
  type DatabaseExecutorSource,
} from '../../../../infrastructure/db/db.js'
import * as schema from '../../../../infrastructure/db/schema/index.js'
import { InternalError } from '../../../../shared/errors/HttpErrors.js'
import {
  OneTimeToken,
  type OneTimeTokenProps,
  type OneTimeTokenType,
} from '../../domain/entities/OneTimeToken.js'
import type {
  CreateOneTimeTokenParams,
  IOneTimeTokenRepository,
} from '../../domain/repositories/IOneTimeTokenRepository.js'

@injectable()
export class OneTimeTokenRepository implements IOneTimeTokenRepository {
  private readonly database: DatabaseExecutor

  public constructor(
    @inject(TYPES.DbPool)
    source: DatabaseExecutorSource,
  ) {
    this.database = createDatabaseExecutor(source)
  }

  public async create(params: CreateOneTimeTokenParams): Promise<OneTimeToken> {
    const [token] = await this.database
      .insert(schema.oneTimeTokens)
      .values({
        userId: params.userId,
        type: params.type,
        tokenHash: params.tokenHash,
        requestedByIp: params.requestedByIp,
        expiresAt: params.expiresAt,
      })
      .returning()

    if (token === undefined) {
      throw new InternalError('Failed to create one-time token')
    }

    return this.mapToEntity(token)
  }

  public async findActiveByType(
    type: OneTimeTokenType,
    referenceDate = new Date(),
  ): Promise<OneTimeToken[]> {
    const rows = await this.database
      .select()
      .from(schema.oneTimeTokens)
      .where(
        and(
          eq(schema.oneTimeTokens.type, type),
          isNull(schema.oneTimeTokens.usedAt),
          gt(schema.oneTimeTokens.expiresAt, referenceDate),
        ),
      )

    return rows.map((row) => this.mapToEntity(row))
  }

  public async markAsUsed(id: string, usedAt = new Date()): Promise<void> {
    await this.database
      .update(schema.oneTimeTokens)
      .set({
        usedAt,
      })
      .where(eq(schema.oneTimeTokens.id, id))
  }

  private mapToEntity(
    row: typeof schema.oneTimeTokens.$inferSelect,
  ): OneTimeToken {
    const props: OneTimeTokenProps = {
      id: row.id,
      userId: row.userId,
      type: row.type as OneTimeTokenType,
      tokenHash: row.tokenHash,
      requestedByIp: row.requestedByIp ?? null,
      expiresAt: row.expiresAt,
      usedAt: row.usedAt ?? null,
      createdAt: row.createdAt,
    }

    return new OneTimeToken(props)
  }
}
