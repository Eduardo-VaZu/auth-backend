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

/**
 * OWASP A02 - Cryptographic Failures / Session Management
 *
 * Escenario del ataque (refresh token replay tras logout):
 *   El atacante obtuvo o retuvo la cookie de refresh de un usuario
 *   (dispositivo prestado, sesión olvidada, exfiltración por XSS…).
 *   El usuario legítimo cierra sesión. Si el servidor sólo limpia
 *   cookies del lado del navegador pero NO invalida el refresh token
 *   (ni en la base de datos ni en Redis), el atacante puede seguir
 *   generando access tokens indefinidamente con esa cookie robada.
 *
 * Propiedad de seguridad que este test verifica:
 *   Después de POST /auth/logout, el refresh token queda inutilizado
 *   en TODAS las capas (DB revoked_at != NULL, Redis limpio). Un
 *   intento posterior de POST /auth/refresh con la cookie previa
 *   debe fallar con 401.
 */
describe('OWASP A02 - Replay de refresh token tras /auth/logout', () => {
  let app: Express
  let pgContainer: StartedPostgreSqlContainer | null = null
  let redisContainer: StartedTestContainer | null = null
  let pool: Pool | null = null
  let db: AppDatabase | null = null
  let redisClient: AppRedisClient | null = null

  const testRunId = Date.now()
  const user = {
    email: `owasp.logout.replay.${testRunId}@example.com`,
    password: 'UserPassword2026!',
  }

  beforeAll(async () => {
    // eslint-disable-next-line no-console
    console.log('\n[OWASP Logout] Arrancando contenedores...')

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

    await request(app).post('/auth/register').send(user).expect(201)
    await db.execute(
      sql`UPDATE users SET status = 'active' WHERE email = ${user.email}`,
    )
  }, 120000)

  afterAll(async () => {
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

  it('la cookie de refresh capturada antes del logout NO permite refrescar la sesión', async () => {
    if (!db) {
      throw new Error('Database is not initialized')
    }

    // Paso 1 — el usuario inicia sesión y el "atacante" captura las cookies.
    const loginResponse = await request(app)
      .post('/auth/login')
      .send(user)
      .expect(200)
    const capturedCookies = loginResponse.headers['set-cookie'] as
      | string[]
      | undefined

    expect(capturedCookies).toBeDefined()
    if (!capturedCookies) {
      throw new Error('Login cookies missing')
    }

    // Paso 2 — el usuario legítimo cierra su sesión.
    const logoutResponse = await request(app)
      .post('/auth/logout')
      .set('Cookie', capturedCookies)
    expect(logoutResponse.status).toBeLessThan(500)

    // Paso 3 — EL ATAQUE: el atacante intenta usar el refresh token
    // capturado para obtener un nuevo par de tokens.
    const replayResponse = await request(app)
      .post('/auth/refresh')
      .set('Cookie', capturedCookies)

    // Aseveración de seguridad #1: el intento de replay debe fallar.
    expect(replayResponse.status).toBe(401)

    // Aseveración de seguridad #2: en la base de datos, el refresh
    // token queda con revoked_at distinto de NULL después del logout.
    const refreshRows = await db.execute(
      sql`SELECT revoked_at, revoked_reason FROM refresh_tokens
          WHERE user_id = (SELECT id FROM users WHERE email = ${user.email})
          ORDER BY created_at DESC
          LIMIT 1`,
    )
    const refreshRow = refreshRows.rows[0]
    expect(refreshRow).toBeDefined()
    if (!refreshRow) {
      throw new Error('Refresh token row missing')
    }
    expect(refreshRow.revoked_at).not.toBeNull()
  })
})
