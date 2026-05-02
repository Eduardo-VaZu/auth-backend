import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type EnvInput = Record<string, string | undefined>

const buildBaseEnv = (): EnvInput => ({
  PORT: '3000',
  NODE_ENV: 'test',
  CORS_ORIGIN: 'http://localhost:3000, http://localhost:5173',
  TRUST_PROXY: 'false',
  DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/auth_backend_test',
  DB_POOL_MAX: '10',
  DB_POOL_IDLE_TIMEOUT: '1000',
  DB_POOL_CONNECTION_TIMEOUT: '1000',
  REDIS_URL: 'redis://localhost:6379',
  ACCESS_TOKEN_SECRET: '12345678901234567890123456789012',
  REFRESH_TOKEN_SECRET: 'abcdefghijabcdefghijabcdefghijab',
  ACCESS_TOKEN_EXPIRES_IN: '15m',
  REFRESH_TOKEN_EXPIRES_IN: '7d',
  COOKIE_SECRET: 'cookie-secret-cookie-secret-cookie',
  COOKIE_DOMAIN: 'localhost',
  COOKIE_SECURE: 'false',
  COOKIE_SAME_SITE: 'lax',
  MAX_SESSIONS_PER_USER: '5',
  SHUTDOWN_TIMEOUT_MS: '5000',
  EMAIL_DELIVERY_MODE: 'preview',
})

describe('env config', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  it('parses and coerces env vars with defaults', async () => {
    process.env = {
      ...buildBaseEnv(),
      TRUST_PROXY: 'true',
      COOKIE_SECURE: 'true',
      EXPIRED_SESSION_RETENTION_SECONDS: undefined,
    }

    const { env } = await import('@/config/env.js')

    expect(env.PORT).toBe(3000)
    expect(env.TRUST_PROXY).toBe(true)
    expect(env.CORS_ORIGIN).toEqual([
      'http://localhost:3000',
      'http://localhost:5173',
    ])
    expect(env.COOKIE_SECURE).toBe(true)
    expect(env.EXPIRED_SESSION_RETENTION_SECONDS).toBe(0)
    expect(env.BREVO_SENDER_NAME).toBe('Auth Backend')
  })

  it('requires brevo delivery mode in production', async () => {
    process.env = {
      ...buildBaseEnv(),
      NODE_ENV: 'production',
      EMAIL_DELIVERY_MODE: 'preview',
    }

    const stderrWrite = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true)
    const exitMock = vi.spyOn(process, 'exit').mockImplementation(((
      code?: number,
    ) => {
      throw new Error(`process.exit:${code ?? 0}`)
    }) as (code?: number) => never)

    await expect(import('@/config/env.js')).rejects.toThrow('process.exit:1')
    expect(exitMock).toHaveBeenCalledWith(1)
    expect(stderrWrite).toHaveBeenCalledWith(
      expect.stringContaining('Production requires EMAIL_DELIVERY_MODE=brevo'),
    )
  })

  it('requires brevo credentials when delivery mode is brevo', async () => {
    process.env = {
      ...buildBaseEnv(),
      EMAIL_DELIVERY_MODE: 'brevo',
      BREVO_API_KEY: undefined,
      BREVO_SENDER_EMAIL: undefined,
    }

    const stderrWrite = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true)
    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code ?? 0}`)
    }) as (code?: number) => never)

    await expect(import('@/config/env.js')).rejects.toThrow('process.exit:1')
    expect(stderrWrite).toHaveBeenCalledWith(
      expect.stringContaining('BREVO_API_KEY is required'),
    )
    expect(stderrWrite).toHaveBeenCalledWith(
      expect.stringContaining('BREVO_SENDER_EMAIL is required'),
    )
  })
})
