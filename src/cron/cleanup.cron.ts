import cron, { type ScheduledTask } from 'node-cron'
import type { Logger } from 'pino'

import { env } from '../config/env.js'
import { pool } from '../infrastructure/db/db.js'
import { RefreshTokenRepository } from '../modules/access/infrastructure/repositories/RefreshTokenRepository.js'
import { UserSessionRepository } from '../modules/access/infrastructure/repositories/UserSessionRepository.js'

export const startCleanupCron = (logger: Logger): ScheduledTask => {
  const refreshTokenRepository = new RefreshTokenRepository(pool, logger)
  const userSessionRepository = new UserSessionRepository(pool, logger)

  const task = cron.schedule('0 0 * * *', () => {
    void (async () => {
      try {
        const now = new Date()
        const sessionReferenceDate = new Date(
          now.getTime() - env.EXPIRED_SESSION_RETENTION_SECONDS * 1000,
        )
        const deletedTokens = await refreshTokenRepository.deleteExpired(now)
        const deletedSessions =
          await userSessionRepository.deleteExpired(sessionReferenceDate)

        logger.info(
          {
            deletedRefreshTokenCount: deletedTokens,
            deletedUserSessionCount: deletedSessions,
            sessionRetentionSeconds: env.EXPIRED_SESSION_RETENTION_SECONDS,
          },
          'Expired auth artifacts cleanup completed',
        )
      } catch (error: unknown) {
        logger.error(
          {
            err: error,
          },
          'Expired auth artifacts cleanup failed',
        )
      }
    })()
  })

  logger.info('Auth artifact cleanup cron scheduled')

  return task
}

export const stopCronJobs = async (tasks: ScheduledTask[]): Promise<void> => {
  await Promise.all(tasks.map(async (task) => task.stop()))
}
