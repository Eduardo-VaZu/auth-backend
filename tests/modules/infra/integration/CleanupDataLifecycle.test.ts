import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface Artifact {
  id: string
  expiresAt: Date
}

const scheduleMock = vi.fn()
const stopMock = vi.fn(() => Promise.resolve())
const taskMock = {
  stop: stopMock,
}

const state = {
  refreshTokens: [] as Artifact[],
  userSessions: [] as Artifact[],
}

vi.mock('node-cron', () => ({
  default: {
    schedule: scheduleMock,
  },
}))

vi.mock('@/config/env.js', () => ({
  env: {
    EXPIRED_SESSION_RETENTION_SECONDS: 1800,
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
          deleteExpired: vi.fn(async (referenceDate: Date) => {
            const before = state.refreshTokens.length
            state.refreshTokens = state.refreshTokens.filter(
              (token) => token.expiresAt >= referenceDate,
            )
            return before - state.refreshTokens.length
          }),
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
          deleteExpired: vi.fn(async (referenceDate: Date) => {
            const before = state.userSessions.length
            state.userSessions = state.userSessions.filter(
              (session) => session.expiresAt >= referenceDate,
            )
            return before - state.userSessions.length
          }),
        }
      }),
  }),
)

describe('CleanupDataLifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-02T12:00:00.000Z'))
    scheduleMock.mockReset()
    stopMock.mockClear()
    state.refreshTokens = [
      {
        id: 'expired-refresh',
        expiresAt: new Date('2026-05-02T11:59:59.000Z'),
      },
      {
        id: 'active-refresh',
        expiresAt: new Date('2026-05-02T12:15:00.000Z'),
      },
    ]
    state.userSessions = [
      {
        id: 'expired-session',
        expiresAt: new Date('2026-05-02T11:20:00.000Z'),
      },
      {
        id: 'active-session',
        expiresAt: new Date('2026-05-02T11:31:00.000Z'),
      },
    ]
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('removes expired artifacts and keeps active lifecycle artifacts', async () => {
    let scheduledCallback: (() => void) | undefined
    scheduleMock.mockImplementation((_expression, callback: () => void) => {
      scheduledCallback = callback
      return taskMock
    })
    const logger = {
      info: vi.fn(),
      error: vi.fn(),
    }

    const { startCleanupCron } = await import('@/cron/cleanup.cron.js')
    startCleanupCron(logger as never)
    scheduledCallback?.()
    await Promise.resolve()
    await Promise.resolve()

    expect(state.refreshTokens.map((item) => item.id)).toEqual([
      'active-refresh',
    ])
    expect(state.userSessions.map((item) => item.id)).toEqual([
      'active-session',
    ])
    expect(logger.info).toHaveBeenCalledWith(
      {
        deletedRefreshTokenCount: 1,
        deletedUserSessionCount: 1,
        sessionRetentionSeconds: 1800,
      },
      'Expired auth artifacts cleanup completed',
    )
  })
})
