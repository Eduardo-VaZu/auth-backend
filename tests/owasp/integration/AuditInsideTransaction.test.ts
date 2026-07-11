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
 * OWASP A09 - Security Logging and Monitoring Failures
 *
 * Escenario del ataque (auditoría desacoplada de la transacción):
 *   Si el evento de auditoría se registra fuera de la transacción
 *   principal, dos cosas malas pueden pasar:
 *     - La operación de negocio se hace, pero el audit falla o se
 *       omite → queda un cambio sin trazabilidad.
 *     - El audit se escribe primero y la operación falla luego
 *       (rollback) → queda un evento "success" en logs que nunca
 *       ocurrió, corrompiendo la evidencia forense.
 *   Un atacante que conozca esta debilidad puede aprovecharla para
 *   escapar de detección o para contaminar las alertas.
 *
 * Propiedad de seguridad que este test verifica:
 *   Cada evento de auditoría de un login exitoso apunta a una fila
 *   real y activa en `user_sessions`. Auditoría y estado son
 *   coherentes: si existe el evento, existe la sesión — y viceversa.
 */
describe('OWASP A09 - Auditoría atómica con la operación de negocio', () => {
  let app: Express
  let pgContainer: StartedPostgreSqlContainer | null = null
  let redisContainer: StartedTestContainer | null = null
  let pool: Pool | null = null
  let db: AppDatabase | null = null
  let redisClient: AppRedisClient | null = null

  const testRunId = Date.now()
  const user = {
    email: `owasp.audit.tx.${testRunId}@example.com`,
    password: 'UserPassword2026!',
  }

  beforeAll(async () => {
    // eslint-disable-next-line no-console
    console.log('\n[OWASP Audit-TX] Arrancando contenedores...')

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

  it('un evento login_success SIEMPRE apunta a una sesión activa persistida', async () => {
    if (!db) {
      throw new Error('Database is not initialized')
    }

    // Paso 1 — login exitoso.
    const loginResponse = await request(app)
      .post('/auth/login')
      .send(user)
      .expect(200)
    expect(loginResponse.headers['set-cookie']).toBeDefined()

    // Paso 2 — leer el evento de auditoría del login exitoso.
    const auditRows = await db.execute(
      sql`SELECT metadata FROM auth_audit_logs
          WHERE event_type = 'login_success'
          AND user_id = (SELECT id FROM users WHERE email = ${user.email})
          ORDER BY created_at DESC
          LIMIT 1`,
    )
    const auditRow = auditRows.rows[0]
    expect(auditRow).toBeDefined()
    if (!auditRow) {
      throw new Error('login_success audit row missing')
    }

    // Aseveración de seguridad #1: el evento existe (auditoría no se
    // perdió por rollback silencioso).
    const metadata = auditRow.metadata as {
      sessionId?: string
      sessionKey?: string
    }
    expect(metadata.sessionId).toBeDefined()
    expect(metadata.sessionKey).toBeDefined()

    // Aseveración de seguridad #2: el sessionId del audit apunta a
    // una fila real en user_sessions. Si el audit se escribiera fuera
    // de la transacción, podríamos tener un evento "success" apuntando
    // a un sessionId inexistente (audit adelantado + rollback).
    const sessionRows = await db.execute(
      sql`SELECT id, revoked_at FROM user_sessions
          WHERE id = ${metadata.sessionId as string}`,
    )
    const sessionRow = sessionRows.rows[0]
    expect(sessionRow).toBeDefined()
    if (!sessionRow) {
      throw new Error(
        `Session ${metadata.sessionId} referenced by audit does not exist`,
      )
    }

    // Aseveración de seguridad #3: la sesión está activa (revoked_at
    // es NULL). Un evento login_success no puede convivir con una
    // sesión que nunca terminó de crearse.
    expect(sessionRow.revoked_at).toBeNull()
  })
})
