import { asc, eq } from 'drizzle-orm'
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
import type { IRoleRepository } from '../../domain/repositories/IRoleRepository.js'

@injectable()
export class RoleRepository implements IRoleRepository {
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

  public async listAll(): Promise<Role[]> {
    const rows = await this.database
      .select()
      .from(schema.roles)
      .orderBy(asc(schema.roles.code))

    return rows.map((row) => this.mapToEntity(row))
  }

  public async findById(id: string): Promise<Role | null> {
    if (!isUuid(id)) {
      logInvalidUuidDiscard({
        logger: this.logger,
        component: 'RoleRepository',
        field: 'id',
        value: id,
      })
      return null
    }

    const [row] = await this.database
      .select()
      .from(schema.roles)
      .where(eq(schema.roles.id, id))

    return row === undefined ? null : this.mapToEntity(row)
  }

  private mapToEntity(row: typeof schema.roles.$inferSelect): Role {
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
