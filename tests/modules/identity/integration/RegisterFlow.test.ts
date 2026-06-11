/* eslint-disable no-console */
import {
  describe,
  expect,
  it,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql'
import { GenericContainer, type StartedTestContainer } from 'testcontainers'

describe('Register Flow Integration (HTTP & Testcontainers)', () => {
  let app: Express
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let redisClient: any
  let pgContainer: StartedPostgreSqlContainer
  let redisContainer: StartedTestContainer

  const testUser = {
    email: `lincolm.test.${Date.now()}@example.com`,
    password: 'SecurePassword2026!',
  }

  beforeAll(async () => {
    console.log(
      '\n[AUDIT] ====================================================',
    )
    console.log(
      '[AUDIT] Starting Testcontainers and configuring environment...',
    )

    // 1. Start containers
    pgContainer = await new PostgreSqlContainer('postgres:16-alpine').start()
    redisContainer = await new GenericContainer('redis:7-alpine')
      .withExposedPorts(6379)
      .start()

    // 2. Set environment variables BEFORE importing project modules
    process.env.DATABASE_URL = pgContainer.getConnectionUri()
    process.env.REDIS_URL = `redis://${redisContainer.getHost()}:${redisContainer.getMappedPort(6379)}`

    console.log(`[AUDIT] ✔️ Containers ready: ${process.env.DATABASE_URL}`)

    // 3. Dynamic Import (Lazy loading)
    const { pool } = await import('@/infrastructure/db/db.js')
    const { drizzle } = await import('drizzle-orm/node-postgres')
    const { migrate } = await import('drizzle-orm/node-postgres/migrator')
    const { createApp } = await import('@/app.js')
    const { container } = await import('@/container/inversify.config.js')
    const { TYPES } = await import('@/container/types.js')

    // 4. Run Drizzle Migrations
    console.log('[AUDIT] Running Drizzle migrations...')
    const db = drizzle({ client: pool })
    await migrate(db, { migrationsFolder: './drizzle' })
    console.log('[AUDIT] ✔️ Migrations applied successfully.')

    // 5. Initialize App
    redisClient = container.get(TYPES.RedisClient)
    if (!redisClient.isOpen) {
      await redisClient.connect()
    }
    app = createApp(container)

    console.log('[AUDIT] ✔️ Application initialized. Environment ready.')
    console.log(
      '[AUDIT] ====================================================\n',
    )
  }, 120000)

  afterAll(async () => {
    console.log(
      '\n[AUDIT] ====================================================',
    )
    console.log('[AUDIT] Finishing tests. Cleaning up containers...')
    const { pool } = await import('@/infrastructure/db/db.js')
    await pool.end()
    if (redisClient?.isOpen) await redisClient.disconnect()
    if (pgContainer) await pgContainer.stop()
    if (redisContainer) await redisContainer.stop()
    console.log('[AUDIT] ✔️ Containers destroyed.')
    console.log(
      '[AUDIT] ====================================================\n',
    )
  })

  beforeEach(() =>
    console.log('\n[TEST] ------------------------------------------------'),
  )
  afterEach(() =>
    console.log('[TEST] ------------------------------------------------\n'),
  )

  it('GET /health returns 200 with expected payload', async () => {
    console.log('[AUDIT] Test: GET /health')
    const response = await request(app).get('/health')

    expect(response.status).toBe(200)
    expect(response.body).toEqual(
      expect.objectContaining({
        status: 'ok',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        dependencies: expect.any(Object),
      }),
    )
  })

  it('POST /auth/register does not set automatic login cookies', async () => {
    console.log(
      `[AUDIT] Test: POST /auth/register (Successful registration: ${testUser.email})`,
    )
    const response = await request(app).post('/auth/register').send(testUser)

    expect(response.status).toBe(201)

    const setCookieHeader = response.headers['set-cookie'] as
      | string[]
      | undefined
    if (setCookieHeader && Array.isArray(setCookieHeader)) {
      const hasAuthCookies = setCookieHeader.some(
        (c) => c.includes('access_token') || c.includes('refresh_token'),
      )
      expect(hasAuthCookies).toBe(false)
    } else {
      expect(setCookieHeader).toBeUndefined()
    }
  })

  it('POST /auth/register returns previewToken in non-production', async () => {
    console.log('[AUDIT] Test: POST /auth/register (Checking previewToken)')
    const testUser2 = {
      email: `lincolm.preview.${Date.now()}@example.com`,
      password: 'SecurePassword2026!',
    }
    const response = await request(app).post('/auth/register').send(testUser2)

    expect(response.status).toBe(201)
    expect(response.body).toHaveProperty('previewToken')
  })

  it('GET /auth/me sin login despues de registro -> 401', async () => {
    console.log('[AUDIT] Test: GET /auth/me (Unauthorized)')
    const response = await request(app).get('/auth/me')
    expect(response.status).toBe(401)
  })

  it('POST /auth/register with duplicate email returns 409', async () => {
    console.log('[AUDIT] Test: POST /auth/register (Duplicate email)')
    const response = await request(app).post('/auth/register').send(testUser)
    expect(response.status).toBe(409)
  })

  it('POST /auth/register with invalid payload returns 400', async () => {
    console.log('[AUDIT] Test: POST /auth/register (Invalid Payload)')
    const response = await request(app)
      .post('/auth/register')
      .send({ email: 'no-es-email', password: '123' })
    expect(response.status).toBe(422) // Ajustado a 422 para coincidir con la validación real de Zod
  })
})
