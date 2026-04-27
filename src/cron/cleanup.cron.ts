import cron, { type ScheduledTask } from 'node-cron'
import { and, isNotNull, lt } from 'drizzle-orm'
import type { Logger } from 'pino'

import { db } from '../infrastructure/db/db.js'
import { refreshTokens } from '../infrastructure/db/schema/index.js'

export const startCleanupCron = (logger: Logger): ScheduledTask => {
  const task = cron.schedule('0 0 * * *', () => {
    void (async () => {
      try {
        const deletedTokens = await db
          .delete(refreshTokens)
          .where(
            and(
              lt(refreshTokens.expiresAt, new Date()),
              isNotNull(refreshTokens.revokedAt),
            ),
          )
          .returning({
            id: refreshTokens.id,
          })

        logger.info(
          {
            deletedCount: deletedTokens.length,
          },
          'Expired refresh token cleanup completed',
        )
      } catch (error: unknown) {
        logger.error(
          {
            err: error,
          },
          'Expired refresh token cleanup failed',
        )
      }
    })()
  })

  logger.info('Refresh token cleanup cron scheduled')

  return task
}

export const stopCronJobs = async (tasks: ScheduledTask[]): Promise<void> => {
  await Promise.all(tasks.map(async (task) => task.stop()))
}
