import { and, asc, eq, isNull } from 'drizzle-orm'
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
  isUuid,
  logInvalidUuidDiscard,
} from '../../../../shared/utils/isUuid.js'
import { Role } from '../../domain/entities/Role.js'
import type {
  AssignUserRoleParams,
  IUserRoleRepository,
} from '../../domain/repositories/IUserRoleRepository.js'

@injectable()
export class UserRoleRepository implements IUserRoleRepository {
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

  public async listActiveByUserId(userId: string): Promise<Role[]> {
    if (!isUuid(userId)) {
      logInvalidUuidDiscard({
        logger: this.logger,
        component: 'UserRoleRepository',
        field: 'userId',
        value: userId,
      })
      return []
    }

    const rows = await this.database
      .select({
        role: schema.roles,
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

    return rows.map(({ role }) => this.mapRole(role))
  }

  public async assignActiveRole(
    params: AssignUserRoleParams,
  ): Promise<boolean> {
    if (!isUuid(params.userId) || !isUuid(params.roleId)) {
      return false
    }

    const inserted = await this.database
      .insert(schema.userRoles)
      .values({
        userId: params.userId,
        roleId: params.roleId,
        assignedByUserId: params.assignedByUserId,
      })
      .onConflictDoNothing({
        target: [schema.userRoles.userId, schema.userRoles.roleId],
      })
      .returning({
        id: schema.userRoles.id,
      })

    return inserted.length > 0
  }

  public async revokeActiveRole(
    userId: string,
    roleId: string,
    revokedAt = new Date(),
  ): Promise<boolean> {
    if (!isUuid(userId) || !isUuid(roleId)) {
      return false
    }

    const updated = await this.database
      .update(schema.userRoles)
      .set({
        revokedAt,
      })
      .where(
        and(
          eq(schema.userRoles.userId, userId),
          eq(schema.userRoles.roleId, roleId),
          isNull(schema.userRoles.revokedAt),
        ),
      )
      .returning({
        id: schema.userRoles.id,
      })

    return updated.length > 0
  }

  private mapRole(row: typeof schema.roles.$inferSelect): Role {
    return new Role({
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description ?? null,
      isSystem: row.isSystem,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })
  }
}
