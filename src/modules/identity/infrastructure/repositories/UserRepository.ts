import { and, asc, count, desc, eq, ilike, isNull, sql, type SQL } from 'drizzle-orm'
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
  ListUsersPaginatedParams,
  ListUsersPaginatedResult,
  SoftDeleteUserParams,
  UpdateUserEmailForReverificationParams,
  UpdateUserStatusParams,
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

  public async listPaginated(
    params: ListUsersPaginatedParams,
  ): Promise<ListUsersPaginatedResult> {
    const filters: SQL<unknown>[] = []

    if (params.status !== undefined) {
      filters.push(eq(schema.users.status, params.status))
    }

    if (params.search !== undefined) {
      filters.push(ilike(schema.users.email, `%${params.search}%`))
    }

    const whereClause = filters.length === 0 ? undefined : and(...filters)

    const [totalRows, userRows] = await Promise.all([
      this.database
        .select({
          count: count(),
        })
        .from(schema.users)
        .where(whereClause),
      this.database
        .select()
        .from(schema.users)
        .where(whereClause)
        .orderBy(desc(schema.users.createdAt))
        .limit(params.limit)
        .offset(params.offset),
    ])

    const usersWithRoles = await Promise.all(
      userRows.map(async (userRow) => {
        const roles = await this.findActiveRolesByUserId(userRow.id)

        return this.mapToEntity(userRow, roles)
      }),
    )

    return {
      users: usersWithRoles,
      total: totalRows[0] === undefined ? 0 : Number(totalRows[0].count),
    }
  }

  public async updateStatus(params: UpdateUserStatusParams): Promise<User | null> {
    const updatedAt = params.updatedAt ?? new Date()
    const [row] = await this.database
      .update(schema.users)
      .set({
        status: params.status,
        updatedAt,
        authzVersion: sql`${schema.users.authzVersion} + 1`,
      })
      .where(eq(schema.users.id, params.userId))
      .returning()

    if (row === undefined) {
      return null
    }

    const roles = await this.findActiveRolesByUserId(row.id)

    return this.mapToEntity(row, roles)
  }

  public async softDelete(params: SoftDeleteUserParams): Promise<User | null> {
    const deletedAt = params.deletedAt ?? new Date()
    const [row] = await this.database
      .update(schema.users)
      .set({
        deletedAt,
        status: 'disabled',
        updatedAt: deletedAt,
        authzVersion: sql`${schema.users.authzVersion} + 1`,
      })
      .where(eq(schema.users.id, params.userId))
      .returning()

    if (row === undefined) {
      return null
    }

    const roles = await this.findActiveRolesByUserId(row.id)

    return this.mapToEntity(row, roles)
  }

  public async updateEmailForReverification(
    params: UpdateUserEmailForReverificationParams,
  ): Promise<User | null> {
    const updatedAt = params.updatedAt ?? new Date()
    const [row] = await this.database
      .update(schema.users)
      .set({
        email: params.email,
        emailVerifiedAt: null,
        status: 'pending_verification',
        updatedAt,
        authzVersion: sql`${schema.users.authzVersion} + 1`,
      })
      .where(eq(schema.users.id, params.userId))
      .returning()

    if (row === undefined) {
      return null
    }

    const roles = await this.findActiveRolesByUserId(row.id)

    return this.mapToEntity(row, roles)
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
