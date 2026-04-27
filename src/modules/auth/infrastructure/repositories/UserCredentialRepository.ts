import { eq } from 'drizzle-orm'
import { inject, injectable } from 'inversify'

import { TYPES } from '../../../../container/types.js'
import {
  createDatabaseExecutor,
  type DatabaseExecutor,
  type DatabaseExecutorSource,
} from '../../../../infrastructure/db/db.js'
import * as schema from '../../../../infrastructure/db/schema/index.js'
import { InternalError } from '../../../../shared/errors/HttpErrors.js'
import { UserCredential } from '../../domain/entities/UserCredential.js'
import type {
  CreateUserCredentialParams,
  IUserCredentialRepository,
  UpdateUserPasswordParams,
} from '../../domain/repositories/IUserCredentialRepository.js'

@injectable()
export class UserCredentialRepository implements IUserCredentialRepository {
  private readonly database: DatabaseExecutor

  public constructor(
    @inject(TYPES.DbPool)
    source: DatabaseExecutorSource,
  ) {
    this.database = createDatabaseExecutor(source)
  }

  public async findByUserId(userId: string): Promise<UserCredential | null> {
    const [credential] = await this.database
      .select()
      .from(schema.userCredentials)
      .where(eq(schema.userCredentials.userId, userId))

    return credential === undefined ? null : this.mapToEntity(credential)
  }

  public async create(
    params: CreateUserCredentialParams,
  ): Promise<UserCredential> {
    const [credential] = await this.database
      .insert(schema.userCredentials)
      .values({
        userId: params.userId,
        passwordHash: params.passwordHash,
        passwordChangedAt: params.passwordChangedAt ?? new Date(),
        passwordVersion: params.passwordVersion ?? 1,
        mustChangePassword: params.mustChangePassword ?? false,
      })
      .returning()

    if (credential === undefined) {
      throw new InternalError('Failed to create user credential')
    }

    return this.mapToEntity(credential)
  }

  public async updatePassword(
    params: UpdateUserPasswordParams,
  ): Promise<UserCredential> {
    const updatedAt = new Date()
    const [credential] = await this.database
      .update(schema.userCredentials)
      .set({
        passwordHash: params.passwordHash,
        passwordChangedAt: params.passwordChangedAt ?? updatedAt,
        passwordVersion: params.passwordVersion,
        mustChangePassword: params.mustChangePassword ?? false,
        updatedAt,
      })
      .where(eq(schema.userCredentials.userId, params.userId))
      .returning()

    if (credential === undefined) {
      throw new InternalError('Failed to update user credential')
    }

    return this.mapToEntity(credential)
  }

  private mapToEntity(
    row: typeof schema.userCredentials.$inferSelect,
  ): UserCredential {
    return new UserCredential({
      id: row.id,
      userId: row.userId,
      passwordHash: row.passwordHash,
      passwordChangedAt: row.passwordChangedAt,
      passwordVersion: row.passwordVersion,
      mustChangePassword: row.mustChangePassword,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })
  }
}
