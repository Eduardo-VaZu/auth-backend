import { Container } from 'inversify'
import type { Pool } from 'pg'
import type { Logger } from 'pino'

import { pool } from '../infrastructure/db/db.js'
import { redisClient, type AppRedisClient } from '../infrastructure/redis.js'
import { configureAccessModule } from '../modules/access/access.module.js'
import { configureAdminModule } from '../modules/admin/admin.module.js'
import { configureAuditModule } from '../modules/audit/audit.module.js'
import { configureCredentialsModule } from '../modules/credentials/credentials.module.js'
import { configureIdentityModule } from '../modules/identity/identity.module.js'
import { HealthController } from '../modules/health/HealthController.js'
import { appLogger } from '../shared/logger/logger.js'
import { AuthUnitOfWork } from '../shared/infrastructure/services/AuthUnitOfWork.js'
import { TYPES } from './types.js'

export const container = new Container({
  defaultScope: 'Singleton',
})

// Infraestructura Global
container.bind<Logger>(TYPES.Logger).toConstantValue(appLogger)
container.bind<Pool>(TYPES.DbPool).toConstantValue(pool)
container.bind<AppRedisClient>(TYPES.RedisClient).toConstantValue(redisClient)

// Shared Services
container.bind(TYPES.IAuthUnitOfWork).to(AuthUnitOfWork)

// Health
container.bind(TYPES.HealthController).to(HealthController)

// Carga de Módulos (Manual para control total en v7)
configureIdentityModule(container)
configureCredentialsModule(container)
configureAccessModule(container)
configureAdminModule(container)
configureAuditModule(container)
