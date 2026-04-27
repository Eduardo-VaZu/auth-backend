import { env } from '../config/env.js'

import 'reflect-metadata'

import { createServer } from 'node:http'
import type { ScheduledTask } from 'node-cron'

import type { Logger } from 'pino'

import { createApp } from '../app.js'
import { startCleanupCron, stopCronJobs } from '../cron/cleanup.cron.js'
import { container } from '../container/inversify.config.js'
import { TYPES } from '../container/types.js'
import {
  closeDatabasePool,
  verifyDatabaseConnection,
} from '../infrastructure/db/db.js'
import {
  disconnectRedis,
  verifyRedisConnection,
} from '../infrastructure/redis.js'

const startServer = async (): Promise<void> => {
  const logger = container.get<Logger>(TYPES.Logger)

  await verifyDatabaseConnection(logger)
  await verifyRedisConnection(logger)

  const app = createApp(container)
  const server = createServer(app)
  const cronJobs: ScheduledTask[] = [startCleanupCron(logger)]
  let isShuttingDown = false

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (isShuttingDown) {
      return
    }

    isShuttingDown = true

    logger.info(
      {
        signal,
      },
      'Graceful shutdown started',
    )

    const timeout = setTimeout(() => {
      logger.fatal(
        {
          signal,
        },
        'Graceful shutdown timed out',
      )

      process.exit(1)
    }, env.SHUTDOWN_TIMEOUT_MS)

    timeout.unref()

    try {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error !== undefined) {
            reject(error)

            return
          }

          resolve()
        })
      })

      await stopCronJobs(cronJobs)
      await closeDatabasePool()
      await disconnectRedis()

      clearTimeout(timeout)

      logger.info(
        {
          signal,
        },
        'Graceful shutdown completed',
      )

      process.exit(0)
    } catch (error: unknown) {
      clearTimeout(timeout)

      logger.fatal(
        {
          err: error,
          signal,
        },
        'Graceful shutdown failed',
      )

      process.exit(1)
    }
  }

  server.on('error', (error) => {
    logger.fatal(
      {
        err: error,
      },
      'Server failed to start',
    )

    process.exit(1)
  })

  process.once('SIGINT', () => {
    shutdown('SIGINT').catch((error: unknown) => {
      logger.fatal(
        {
          err: error,
          signal: 'SIGINT',
        },
        'SIGINT shutdown handler failed',
      )

      process.exit(1)
    })
  })

  process.once('SIGTERM', () => {
    shutdown('SIGTERM').catch((error: unknown) => {
      logger.fatal(
        {
          err: error,
          signal: 'SIGTERM',
        },
        'SIGTERM shutdown handler failed',
      )

      process.exit(1)
    })
  })

  server.listen(env.PORT, () => {
    logger.info(
      {
        port: env.PORT,
      },
      'HTTP server listening',
    )
  })
}

startServer().catch((error: unknown) => {
  process.stderr.write(
    `Fatal startup error: ${error instanceof Error ? error.message : 'unknown error'}\n`,
  )
  process.exit(1)
})
