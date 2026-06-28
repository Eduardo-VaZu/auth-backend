/* eslint-disable no-console */
import { sql } from 'drizzle-orm'
import request from 'supertest'
import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import type { Express } from 'express'
import type { Pool } from 'pg'
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql'
import { GenericContainer, type StartedTestContainer } from 'testcontainers'
import type { AppDatabase } from '@/infrastructure/db/db.js'
import type { AppRedisClient } from '@/infrastructure/redis.js'

describe('OWASP - Auth flow hardening integration', () => {
  let app: Express
  let redisClient: AppRedisClient | null = null
  let pgContainer: StartedPostgreSqlContainer | null = null
  let redisContainer: StartedTestContainer | null = null
  let pool: Pool | null = null
  let db: AppDatabase | null = null

  const testRunId = Date.now()
  const testUser = {
    email: `owasp.auth.${testRunId}@example.com`,
    password: 'SecurePassword2026!',
  }
  const adminUser = {
    email: `owasp.admin.${testRunId}@example.com`,
    password: 'SecurePassword2026!',
  }
  const searchableUser = {
    email: `needle.owasp.${testRunId}@example.com`,
    password: 'SecurePassword2026!',
  }
  const bystanderUser = {
    email: `bystander.owasp.${testRunId}@example.com`,
    password: 'SecurePassword2026!',
  }

  const getDatabaseDependencies = () => {
    if (db === null) {
      throw new Error('OWASP test environment was not initialized correctly')
    }

    return { db }
  }

  const activateUserByEmail = async (email: string) => {
    const { db } = getDatabaseDependencies()

    await db.execute(
      sql`UPDATE users SET status = 'active' WHERE email = ${email}`,
    )
  }

  const registerAndActivateUser = async (credentials: {
    email: string
    password: string
  }) => {
    await request(app).post('/auth/register').send(credentials).expect(201)
    await activateUserByEmail(credentials.email)
  }

  const grantAdminRoleByEmail = async (email: string) => {
    const { db } = getDatabaseDependencies()

    await db.execute(sql`
      INSERT INTO roles (code, name, description, is_system)
      VALUES ('admin', 'Administrator', 'Full administrative access', true)
      ON CONFLICT (code) DO NOTHING
    `)

    await db.execute(sql`
      INSERT INTO user_roles (user_id, role_id)
      SELECT users.id, roles.id
      FROM users
      INNER JOIN roles ON roles.code = 'admin'
      WHERE users.email = ${email}
      ON CONFLICT DO NOTHING
    `)
  }

  const loginAndGetCookies = async (credentials: {
    email: string
    password: string
  }) => {
    const response = await request(app).post('/auth/login').send(credentials)
    const cookies = response.headers['set-cookie'] as string[] | undefined

    expect(response.status).toBe(200)
    expect(cookies).toBeDefined()

    if (!cookies) {
      throw new Error('Missing login cookies')
    }

    return cookies
  }

  beforeAll(async () => {
    console.log('\n[OWASP] Starting PostgreSQL and Redis containers...')

    pgContainer = await new PostgreSqlContainer('postgres:16-alpine').start()
    redisContainer = await new GenericContainer('redis:7-alpine')
      .withExposedPorts(6379)
      .start()

    process.env.DATABASE_URL = pgContainer.getConnectionUri()
    process.env.REDIS_URL = `redis://${redisContainer.getHost()}:${redisContainer.getMappedPort(6379)}`

    const dbModule = await import('@/infrastructure/db/db.js')
    const { migrate } = await import('drizzle-orm/node-postgres/migrator')
    const appModule = await import('@/app.js')
    const containerModule = await import('@/container/inversify.config.js')
    const typesModule = await import('@/container/types.js')

    pool = dbModule.pool
    db = dbModule.db

    await migrate(db, { migrationsFolder: './drizzle' })

    const resolvedRedisClient = containerModule.container.get<AppRedisClient>(
      typesModule.TYPES.RedisClient,
    )
    redisClient = resolvedRedisClient

    if (!resolvedRedisClient.isOpen) {
      await resolvedRedisClient.connect()
    }

    app = appModule.createApp(containerModule.container)

    await registerAndActivateUser(testUser)

    console.log('[OWASP] Environment ready.')
  }, 120000)

  afterAll(async () => {
    console.log('\n[OWASP] Cleaning containers...')

    if (pool !== null) {
      await pool.end()
    }
    if (redisClient?.isOpen) {
      await redisClient.disconnect()
    }
    if (pgContainer) {
      await pgContainer.stop()
    }
    if (redisContainer) {
      await redisContainer.stop()
    }
  })

  it('POST /auth/login returns same response for nonexistent user and wrong password', async () => {
    const wrongPasswordResponse = await request(app).post('/auth/login').send({
      email: testUser.email,
      password: 'WrongPassword123!',
    })

    const nonexistentUserResponse = await request(app)
      .post('/auth/login')
      .send({
        email: `missing.${Date.now()}@example.com`,
        password: 'WrongPassword123!',
      })

    expect(wrongPasswordResponse.status).toBe(401)
    expect(nonexistentUserResponse.status).toBe(401)
    expect(wrongPasswordResponse.body.error.code).toBe('UNAUTHORIZED')
    expect(nonexistentUserResponse.body.error.code).toBe('UNAUTHORIZED')
    expect(wrongPasswordResponse.body.error.message).toBe('Invalid credentials')
    expect(nonexistentUserResponse.body.error.message).toBe(
      'Invalid credentials',
    )
    expect(wrongPasswordResponse.headers['set-cookie']).toBeUndefined()
    expect(nonexistentUserResponse.headers['set-cookie']).toBeUndefined()
  })

  it('POST /auth/refresh replay revokes current session family', async () => {
    const loginResponse = await request(app).post('/auth/login').send(testUser)
    const initialCookies = loginResponse.headers['set-cookie'] as
      | string[]
      | undefined

    expect(loginResponse.status).toBe(200)
    expect(initialCookies).toBeDefined()
    if (!initialCookies) {
      throw new Error('Missing login cookies')
    }

    const refreshResponse = await request(app)
      .post('/auth/refresh')
      .set('Cookie', initialCookies)
    const rotatedCookies = refreshResponse.headers['set-cookie'] as
      | string[]
      | undefined

    expect(refreshResponse.status).toBe(200)
    expect(rotatedCookies).toBeDefined()
    if (!rotatedCookies) {
      throw new Error('Missing rotated cookies')
    }

    const replayResponse = await request(app)
      .post('/auth/refresh')
      .set('Cookie', initialCookies)

    expect(replayResponse.status).toBe(401)
    expect(replayResponse.body.error.code).toBe('UNAUTHORIZED')
    expect(replayResponse.body.error.message).toBe(
      'Refresh token is invalid or expired',
    )

    const sessionsAfterReplayResponse = await request(app)
      .get('/auth/sessions')
      .set('Cookie', rotatedCookies)

    expect(sessionsAfterReplayResponse.status).toBe(401)
    expect(sessionsAfterReplayResponse.body.error.code).toBe('UNAUTHORIZED')
    expect(sessionsAfterReplayResponse.body.error.message).toBe(
      'Session is no longer active',
    )
  })

  it('GET /admin/users keeps search bounded when q contains deep SQL injection payload', async () => {
    await registerAndActivateUser(adminUser)
    await grantAdminRoleByEmail(adminUser.email)
    await registerAndActivateUser(searchableUser)
    await registerAndActivateUser(bystanderUser)

    const adminCookies = await loginAndGetCookies(adminUser)

    const baselineResponse = await request(app)
      .get('/admin/users')
      .set('Cookie', adminCookies)
      .query({ page: 1, limit: 100 })

    expect(baselineResponse.status).toBe(200)
    expect(baselineResponse.body.pagination.total).toBeGreaterThanOrEqual(4)

    const targetedSearchResponse = await request(app)
      .get('/admin/users')
      .set('Cookie', adminCookies)
      .query({ page: 1, limit: 100, q: 'needle.owasp' })

    expect(targetedSearchResponse.status).toBe(200)
    expect(targetedSearchResponse.body.pagination.total).toBe(1)
    expect(targetedSearchResponse.body.users).toEqual([
      expect.objectContaining({
        email: searchableUser.email,
      }),
    ])

    const injectionResponse = await request(app)
      .get('/admin/users')
      .set('Cookie', adminCookies)
      .query({ page: 1, limit: 100, q: "' OR 1=1 --" })

    expect(injectionResponse.status).toBe(200)
    expect(injectionResponse.body.pagination.total).toBe(0)
    expect(injectionResponse.body.users).toEqual([])
  })
})
