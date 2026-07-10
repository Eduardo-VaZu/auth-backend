import { sql } from 'drizzle-orm'
import type { Express } from 'express'
import type { Pool } from 'pg'
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql'
import { GenericContainer, type StartedTestContainer } from 'testcontainers'
import request from 'supertest'
import { describe, expect, it, beforeAll, afterAll } from 'vitest'

import type { AppDatabase } from '@/infrastructure/db/db.js'
import type { AppRedisClient } from '@/infrastructure/redis.js'

describe('OWASP - IDOR en Revocación de Sesiones', () => {
  let app: Express
  let pgContainer: StartedPostgreSqlContainer | null = null
  let redisContainer: StartedTestContainer | null = null
  let pool: Pool | null = null
  let db: AppDatabase | null = null
  let redisClient: AppRedisClient | null = null

  const testRunId = Date.now()
  const userA = {
    email: `owasp.idor.a.${testRunId}@example.com`,
    password: 'SecurePassword2026!',
  }
  const userB = {
    email: `owasp.idor.b.${testRunId}@example.com`,
    password: 'SecurePassword2026!',
  }

  beforeAll(async () => {
    // eslint-disable-next-line no-console
    console.log('\n[OWASP IDOR] Arrancando contenedores PostgreSQL y Redis...')

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

    redisClient = containerModule.container.get<AppRedisClient>(
      typesModule.TYPES.RedisClient,
    )

    if (!redisClient.isOpen) {
      await redisClient.connect()
    }

    app = appModule.createApp(containerModule.container)

    // Registrar y activar ambos usuarios para la prueba
    await request(app).post('/auth/register').send(userA).expect(201)
    await request(app).post('/auth/register').send(userB).expect(201)

    // Activarlos directamente en la DB
    await db.execute(
      sql`UPDATE users SET status = 'active' WHERE email IN (${userA.email}, ${userB.email})`,
    )

    // eslint-disable-next-line no-console
    console.log('[OWASP IDOR] Entorno de prueba inicializado.')
  }, 120000)

  afterAll(async () => {
    // eslint-disable-next-line no-console
    console.log('\n[OWASP IDOR] Limpiando contenedores...')

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

  it('debe denegar el acceso (404) cuando el Usuario A intenta revocar la sesión del Usuario B', async () => {
    if (!db) {
      throw new Error('Database is not initialized')
    }

    // 1. Login del Usuario A (Atacante)
    const loginARes = await request(app)
      .post('/auth/login')
      .send(userA)
      .expect(200)
    const cookiesUserA = loginARes.headers['set-cookie'] as string[] | undefined

    expect(cookiesUserA).toBeDefined()
    if (!cookiesUserA) {
      throw new Error('Cookies for User A are missing')
    }

    // 2. Login del Usuario B (Víctima)
    const loginBRes = await request(app)
      .post('/auth/login')
      .send(userB)
      .expect(200)
    const cookiesUserB = loginBRes.headers['set-cookie'] as string[] | undefined

    expect(cookiesUserB).toBeDefined()
    if (!cookiesUserB) {
      throw new Error('Cookies for User B are missing')
    }

    // 3. Obtener el ID de la sesión activa del Usuario B
    const sessionsBRes = await request(app)
      .get('/auth/sessions')
      .set('Cookie', cookiesUserB)
      .expect(200)

    const sessions = sessionsBRes.body.sessions
    expect(sessions).toBeInstanceOf(Array)
    expect(sessions.length).toBeGreaterThan(0)

    const firstSession = sessions[0]
    expect(firstSession).toBeDefined()
    if (!firstSession) {
      throw new Error('First session is undefined')
    }
    const sessionIdOfB = firstSession.id as string

    // 4. EL ATAQUE: El Usuario A intenta revocar la sesión de B
    const attackResponse = await request(app)
      .delete(`/auth/sessions/${sessionIdOfB}`)
      .set('Cookie', cookiesUserA)

    // 5. ASEVERACIÓN DE SEGURIDAD (Caso Seguro)
    // El sistema debe responder 404 para no dar indicios de existencia ni permitir la acción.
    expect(attackResponse.status).toBe(404)
    expect(attackResponse.body.error.code).toBe('NOT_FOUND')

    // 6. Verificar en base de datos que la sesión del Usuario B sigue estando activa (revoked_at es NULL)
    const dbSessionQuery = await db.execute(
      sql`SELECT revoked_at FROM user_sessions WHERE id = ${sessionIdOfB}`,
    )
    const firstRow = dbSessionQuery.rows[0]
    expect(firstRow).toBeDefined()
    if (!firstRow) {
      throw new Error('Session row in database is undefined')
    }
    expect(firstRow.revoked_at).toBeNull()
  })
})
