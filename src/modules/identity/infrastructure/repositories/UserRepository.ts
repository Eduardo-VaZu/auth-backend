import { and, asc, eq, isNull } from 'drizzle-orm'
import { inject, injectable } from 'inversify'

import { TYPES } from '../../../../container/types.js'
import {
  createDatabaseExecutor,
  type DatabaseExecutor,
  type DatabaseExecutorSource,
} from '../../../../infrastructure/db/db.js'
import * as schema from '../../../../infrastructure/db/schema/index.js'
import { InternalError } from '../../../../shared/errors/HttpErrors.js'
import type {
  CreateUserParams,
  IUserRepository,
} from '../../domain/repositories/IUserRepository.js'
import {
  User,
  type UserRole,
  type UserStatus,
} from '../../domain/entities/User.js'

@injectable()
export class UserRepository implements IUserRepository {
  private readonly database: DatabaseExecutor

  public constructor(
    @inject(TYPES.DbPool)
    source: DatabaseExecutorSource,
  ) {
    this.database = createDatabaseExecutor(source)
  }

  public async findByEmail(email: string): Promise<User | null> {
    const [user] = await this.database
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))

    if (user === undefined) {
      return null
    }

    const roles = await this.findActiveRolesByUserId(user.id)

    return this.mapToEntity(user, roles)
  }

  public async findById(id: string): Promise<User | null> {
    const [user] = await this.database
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))

    if (user === undefined) {
      return null
    }

    const roles = await this.findActiveRolesByUserId(user.id)

    return this.mapToEntity(user, roles)
  }

  public async create(params: CreateUserParams): Promise<User> {
    const [user] = await this.database
      .insert(schema.users)
      .values({
        email: params.email,
        status: params.status ?? 'active',
      })
      .returning()

    if (user === undefined) {
      throw new InternalError('Failed to create user')
    }

    await this.assignRoleToUser(user.id, params.role ?? 'user')
    const roles = await this.findActiveRolesByUserId(user.id)

    return this.mapToEntity(user, roles)
  }

  public async updateLastLoginAt(
    userId: string,
    lastLoginAt = new Date(),
  ): Promise<void> {
    await this.database
      .update(schema.users)
      .set({
        lastLoginAt,
        updatedAt: lastLoginAt,
      })
      .where(eq(schema.users.id, userId))
  }

  public async markEmailAsVerified(
    userId: string,
    verifiedAt = new Date(),
  ): Promise<void> {
    await this.database
      .update(schema.users)
      .set({
        emailVerifiedAt: verifiedAt,
        updatedAt: verifiedAt,
        status: 'active',
      })
      .where(eq(schema.users.id, userId))
  }

  private async findActiveRolesByUserId(userId: string): Promise<UserRole[]> {
    const userRoleRows = await this.database
      .select({
        code: schema.roles.code,
      })
      .from(schema.userRoles)
      .innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id))
      .where(
        and(
          eq(schema.userRoles.userId, userId),
          isNull(schema.userRoles.revokedAt),
        ),
      )
      .orderBy(asc(schema.userRoles.assignedAt))

    return userRoleRows.map((row) => row.code as UserRole)
  }

  private async assignRoleToUser(userId: string, roleCode: UserRole): Promise<void> {
    const [existingRole] = await this.database
      .select({
        id: schema.roles.id,
      })
      .from(schema.roles)
      .where(eq(schema.roles.code, roleCode))
      .limit(1)

    let roleId = existingRole?.id

    if (roleId === undefined) {
      const [createdRole] = await this.database
        .insert(schema.roles)
        .values({
          code: roleCode,
          name: roleCode === 'admin' ? 'Administrator' : 'User',
          description:
            roleCode === 'admin'
              ? 'Full administrative access'
              : 'Default authenticated user role',
          isSystem: true,
        })
        .onConflictDoNothing({
          target: schema.roles.code,
        })
        .returning({
          id: schema.roles.id,
        })

      roleId = createdRole?.id

      if (roleId === undefined) {
        const [roleAfterConflict] = await this.database
          .select({
            id: schema.roles.id,
          })
          .from(schema.roles)
          .where(eq(schema.roles.code, roleCode))
          .limit(1)

        roleId = roleAfterConflict?.id
      }
    }

    if (roleId === undefined) {
      throw new InternalError('Failed to resolve user role')
    }

    await this.database
      .insert(schema.userRoles)
      .values({
        userId,
        roleId,
      })
  }

  private mapToEntity(
    row: typeof schema.users.$inferSelect,
    roles: UserRole[],
  ): User {
    return new User({
      id: row.id,
      email: row.email,
      roles,
      status: row.status as UserStatus,
      authzVersion: row.authzVersion,
      emailVerifiedAt: row.emailVerifiedAt ?? null,
      lastLoginAt: row.lastLoginAt ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt ?? null,
    })
  }
}
