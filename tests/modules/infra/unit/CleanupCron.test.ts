import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const scheduleMock = vi.fn()
const refreshDeleteExpiredMock = vi.fn()
const sessionDeleteExpiredMock = vi.fn()
const stopMock = vi.fn(() => Promise.resolve())
const taskMock = {
  stop: stopMock,
}

vi.mock('node-cron', () => ({
  default: {
    schedule: scheduleMock,
  },
}))

vi.mock('@/config/env.js', () => ({
  env: {
    EXPIRED_SESSION_RETENTION_SECONDS: 3600,
  },
}))

vi.mock('@/infrastructure/db/db.js', () => ({
  pool: {},
}))

vi.mock(
  '@/modules/access/infrastructure/repositories/RefreshTokenRepository.js',
  () => ({
    RefreshTokenRepository: vi
      .fn()
      .mockImplementation(function RefreshTokenRepositoryMock() {
        return {
          deleteExpired: refreshDeleteExpiredMock,
        }
      }),
  }),
)

vi.mock(
  '@/modules/access/infrastructure/repositories/UserSessionRepository.js',
  () => ({
    UserSessionRepository: vi
      .fn()
      .mockImplementation(function UserSessionRepositoryMock() {
        return {
          deleteExpired: sessionDeleteExpiredMock,
        }
      }),
  }),
)

describe('cleanup cron', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-02T12:00:00.000Z'))
    scheduleMock.mockReset()
    refreshDeleteExpiredMock.mockReset()
    sessionDeleteExpiredMock.mockReset()
    stopMock.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('purges expired artifacts and logs deleted counts', async () => {
    let scheduledCallback: (() => void) | undefined
    scheduleMock.mockImplementation((_expression, callback: () => void) => {
      scheduledCallback = callback
      return taskMock
    })
    refreshDeleteExpiredMock.mockResolvedValue(3)
    sessionDeleteExpiredMock.mockResolvedValue(2)

    const { startCleanupCron } = await import('@/cron/cleanup.cron.js')
    const logger = {
      info: vi.fn(),
      error: vi.fn(),
    }

    const scheduledTask = startCleanupCron(logger as never)
    expect(scheduledTask).toBe(taskMock)
    expect(scheduleMock).toHaveBeenCalledWith('0 0 * * *', expect.any(Function))

    scheduledCallback?.()
    await Promise.resolve()
    await Promise.resolve()

    const expectedNow = new Date('2026-05-02T12:00:00.000Z')
    expect(refreshDeleteExpiredMock).toHaveBeenCalledWith(expectedNow)
    expect(sessionDeleteExpiredMock).toHaveBeenCalledWith(
      new Date('2026-05-02T11:00:00.000Z'),
    )
    expect(logger.info).toHaveBeenCalledWith(
      {
        deletedRefreshTokenCount: 3,
        deletedUserSessionCount: 2,
        sessionRetentionSeconds: 3600,
      },
      'Expired auth artifacts cleanup completed',
    )
  })

  it('logs cleanup errors without throwing', async () => {
    let scheduledCallback: (() => void) | undefined
    scheduleMock.mockImplementation((_expression, callback: () => void) => {
      scheduledCallback = callback
      return taskMock
    })
    const error = new Error('delete failed')
    refreshDeleteExpiredMock.mockRejectedValue(error)

    const { startCleanupCron } = await import('@/cron/cleanup.cron.js')
    const logger = {
      info: vi.fn(),
      error: vi.fn(),
    }

    startCleanupCron(logger as never)
    scheduledCallback?.()
    await Promise.resolve()
    await Promise.resolve()

    expect(logger.error).toHaveBeenCalledWith(
      {
        err: error,
      },
      'Expired auth artifacts cleanup failed',
    )
  })

  it('stops all tasks in stopCronJobs', async () => {
    const { stopCronJobs } = await import('@/cron/cleanup.cron.js')
    await stopCronJobs([taskMock as never, taskMock as never])
    expect(stopMock).toHaveBeenCalledTimes(2)
  })
})
