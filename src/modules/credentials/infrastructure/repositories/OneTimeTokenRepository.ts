import { and, eq, gt, isNull } from 'drizzle-orm'
import { inject, injectable } from 'inversify'

import { TYPES } from '../../../../container/types.js'
import {
  createDatabaseExecutor,
  type DatabaseExecutor,
  type DatabaseExecutorSource,
} from '../../../../infrastructure/db/db.js'
import {
  emailVerificationTokens,
  type EmailVerificationTokenRow,
} from '../../../../infrastructure/db/schema/email_verification_tokens.js'
import {
  passwordResetTokens,
  type PasswordResetTokenRow,
} from '../../../../infrastructure/db/schema/password_reset_tokens.js'
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
    if (params.type === 'password_reset') {
      const [token] = await this.database
        .insert(passwordResetTokens)
        .values({
          userId: params.userId,
          tokenHash: params.tokenHash,
          requestedByIp: params.requestedByIp,
          expiresAt: params.expiresAt,
        })
        .returning()

      if (token === undefined) {
        throw new InternalError('Failed to create one-time token')
      }

      return this.mapPasswordResetTokenToEntity(token)
    }

    const [token] = await this.database
      .insert(emailVerificationTokens)
      .values({
        userId: params.userId,
        tokenHash: params.tokenHash,
        expiresAt: params.expiresAt,
      })
      .returning()

    if (token === undefined) {
      throw new InternalError('Failed to create one-time token')
    }

    return this.mapEmailVerificationTokenToEntity(token)
  }

  public async findActiveById(
    id: string,
    type: OneTimeTokenType,
    referenceDate = new Date(),
  ): Promise<OneTimeToken | null> {
    if (type === 'password_reset') {
      const [row] = await this.database
        .select()
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.id, id),
            isNull(passwordResetTokens.usedAt),
            gt(passwordResetTokens.expiresAt, referenceDate),
          ),
        )
        .limit(1)

      return row === undefined ? null : this.mapPasswordResetTokenToEntity(row)
    }

    const [row] = await this.database
      .select()
      .from(emailVerificationTokens)
      .where(
        and(
          eq(emailVerificationTokens.id, id),
          isNull(emailVerificationTokens.usedAt),
          gt(emailVerificationTokens.expiresAt, referenceDate),
        ),
      )
      .limit(1)

    return row === undefined ? null : this.mapEmailVerificationTokenToEntity(row)
  }

  public async markAsUsed(
    id: string,
    type: OneTimeTokenType,
    usedAt = new Date(),
  ): Promise<void> {
    if (type === 'password_reset') {
      await this.database
        .update(passwordResetTokens)
        .set({
          usedAt,
        })
        .where(eq(passwordResetTokens.id, id))

      return
    }

    await this.database
      .update(emailVerificationTokens)
      .set({
        usedAt,
      })
      .where(eq(emailVerificationTokens.id, id))
  }

  private mapPasswordResetTokenToEntity(
    row: PasswordResetTokenRow,
  ): OneTimeToken {
    const props: OneTimeTokenProps = {
      id: row.id,
      userId: row.userId,
      type: 'password_reset',
      tokenHash: row.tokenHash,
      requestedByIp: row.requestedByIp ?? null,
      expiresAt: row.expiresAt,
      usedAt: row.usedAt ?? null,
      createdAt: row.createdAt,
    }

    return new OneTimeToken(props)
  }

  private mapEmailVerificationTokenToEntity(
    row: EmailVerificationTokenRow,
  ): OneTimeToken {
    const props: OneTimeTokenProps = {
      id: row.id,
      userId: row.userId,
      type: 'email_verification',
      tokenHash: row.tokenHash,
      requestedByIp: null,
      expiresAt: row.expiresAt,
      usedAt: row.usedAt ?? null,
      createdAt: row.createdAt,
    }

    return new OneTimeToken(props)
  }
}
