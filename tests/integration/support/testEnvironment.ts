import { fileURLToPath } from 'node:url'

import type { Express } from 'express'
import type { Logger } from 'pino'
import { GenericContainer, type StartedTestContainer } from 'testcontainers'
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql'

interface IntegrationRuntime {
  app: Express
  closeDatabasePool: () => Promise<void>
  disconnectRedis: () => Promise<void>
  postgresContainer: StartedPostgreSqlContainer
  redisContainer: StartedTestContainer
}

let runtimePromise: Promise<IntegrationRuntime> | null = null

const setTestEnvironmentVariables = (
  postgresContainer: StartedPostgreSqlContainer,
  redisContainer: StartedTestContainer,
): void => {
  process.env.NODE_ENV = 'test'
  process.env.PORT = '4000'
  process.env.DATABASE_URL = `postgresql://${postgresContainer.getUsername()}:${postgresContainer.getPassword()}@${postgresContainer.getHost()}:${postgresContainer.getMappedPort(5432)}/${postgresContainer.getDatabase()}`
  process.env.REDIS_URL = `redis://${redisContainer.getHost()}:${redisContainer.getMappedPort(6379)}`
  process.env.ACCESS_TOKEN_SECRET =
    'test-access-secret-12345678901234567890'
  process.env.REFRESH_TOKEN_SECRET =
    'test-refresh-secret-123456789012345678'
  process.env.ACCESS_TOKEN_EXPIRES_IN = '15m'
  process.env.REFRESH_TOKEN_EXPIRES_IN = '7d'
  process.env.COOKIE_SECRET = 'test-cookie-secret-123456789012345678901'
  process.env.COOKIE_DOMAIN = 'localhost'
  process.env.COOKIE_SECURE = 'false'
  process.env.COOKIE_SAME_SITE = 'lax'
  process.env.TRUST_PROXY = 'false'
  process.env.CORS_ORIGIN = 'http://localhost:3000'
  process.env.DB_POOL_MAX = '10'
  process.env.DB_POOL_IDLE_TIMEOUT = '10000'
  process.env.DB_POOL_CONNECTION_TIMEOUT = '5000'
  process.env.MAX_SESSIONS_PER_USER = '5'
  process.env.SHUTDOWN_TIMEOUT_MS = '10000'
}

const runMigrationsAndSeed = async (): Promise<void> => {
  const migrationsFolder = fileURLToPath(
    new URL('../../../drizzle', import.meta.url),
  )
  const [{ db }, { migrate }, { seedBaseRoles }] = await Promise.all([
    import('@/infrastructure/db/db.js'),
    import('drizzle-orm/node-postgres/migrator'),
    import('@/infrastructure/db/migrations/seed-roles.js'),
  ])

  await migrate(db, {
    migrationsFolder,
  })
  await seedBaseRoles()
}

const createRuntime = async (): Promise<IntegrationRuntime> => {
  const postgresContainer = await new PostgreSqlContainer(
    'postgres:16-alpine',
  ).start()
  const redisContainer = await new GenericContainer('redis:7-alpine')
    .withExposedPorts(6379)
    .withCommand(['redis-server', '--appendonly', 'no'])
    .start()

  setTestEnvironmentVariables(postgresContainer, redisContainer)

  const [
    { createApp },
    { container },
    { TYPES },
    { appLogger },
    { verifyDatabaseConnection, closeDatabasePool },
    { verifyRedisConnection, disconnectRedis },
  ] = await Promise.all([
    import('@/app.js'),
    import('@/container/inversify.config.js'),
    import('@/container/types.js'),
    import('@/shared/logger/logger.js'),
    import('@/infrastructure/db/db.js'),
    import('@/infrastructure/redis.js'),
  ])

  await runMigrationsAndSeed()

  const logger = container.isBound(TYPES.Logger)
    ? container.get<Logger>(TYPES.Logger)
    : appLogger

  await verifyDatabaseConnection(logger)
  await verifyRedisConnection(logger)

  return {
    app: createApp(container),
    closeDatabasePool,
    disconnectRedis,
    postgresContainer,
    redisContainer,
  }
}

export const startIntegrationTestEnvironment =
  async (): Promise<IntegrationRuntime> => {
    runtimePromise ??= createRuntime()

    return runtimePromise
  }

export const stopIntegrationTestEnvironment = async (): Promise<void> => {
  if (runtimePromise === null) {
    return
  }

  const runtime = await runtimePromise

  await runtime.disconnectRedis()
  await runtime.closeDatabasePool()
  await runtime.redisContainer.stop()
  await runtime.postgresContainer.stop()

  runtimePromise = null
}
