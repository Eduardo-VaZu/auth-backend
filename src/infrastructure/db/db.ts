import { performance } from 'node:perf_hooks'

import { drizzle } from 'drizzle-orm/node-postgres'
import type { Logger } from 'pino'
import { Pool } from 'pg'

import { env } from '../../config/env.js'

export interface DependencyHealth {
  status: 'ok' | 'error'
  latencyMs: number
}

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DB_POOL_MAX,
  idleTimeoutMillis: env.DB_POOL_IDLE_TIMEOUT,
  connectionTimeoutMillis: env.DB_POOL_CONNECTION_TIMEOUT,
})

export const db = drizzle({
  client: pool,
})

export type AppDatabase = typeof db

export type AppTransaction = Parameters<
  Parameters<AppDatabase['transaction']>[0]
>[0]

export type DatabaseExecutor = AppDatabase | AppTransaction

export type DatabaseExecutorSource = Pool | DatabaseExecutor

export const createDatabaseExecutor = (
  source: DatabaseExecutorSource,
): DatabaseExecutor => {
  if (source instanceof Pool) {
    return drizzle({
      client: source,
    })
  }

  return source
}

const exitOnDatabaseError = (logger: Logger, error: unknown): never => {
  logger.fatal(
    {
      err: error,
    },
    'PostgreSQL connection verification failed',
  )

  process.exit(1)
}

export const verifyDatabaseConnection = async (
  logger: Logger,
): Promise<void> => {
  try {
    const startedAt = performance.now()

    await pool.query('SELECT 1')

    logger.info(
      {
        latencyMs: Number((performance.now() - startedAt).toFixed(2)),
      },
      'PostgreSQL connection verified',
    )
  } catch (error: unknown) {
    exitOnDatabaseError(logger, error)
  }
}

export const checkPostgresHealth = async (): Promise<DependencyHealth> => {
  const startedAt = performance.now()

  try {
    await pool.query('SELECT 1')

    return {
      status: 'ok',
      latencyMs: Number((performance.now() - startedAt).toFixed(2)),
    }
  } catch {
    return {
      status: 'error',
      latencyMs: Number((performance.now() - startedAt).toFixed(2)),
    }
  }
}

export const closeDatabasePool = async (): Promise<void> => {
  await pool.end()
}
