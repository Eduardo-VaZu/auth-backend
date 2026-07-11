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
 * OWASP A07 - Identification and Authentication Failures (variant)
 *
 * Escenario del ataque (IP spoofing vía X-Forwarded-For):
 *   El rate limiter y la auditoría usan la IP del cliente como
 *   identificador. Si el servidor está configurado con
 *   `trust proxy = true` SIN un proxy real (Nginx, ALB, Cloudflare)
 *   delante que reescriba `X-Forwarded-For`, cualquier atacante puede
 *   inyectar ese header directamente y hacerse pasar por otra IP.
 *   Consecuencias:
 *     - evade el rate-limit rotando el header entre intentos,
 *     - los eventos de auditoría culpan a IPs inocentes.
 *
 * Propiedad de seguridad que este test verifica:
 *   La IP registrada en `auth_audit_logs` NO refleja el valor que el
 *   cliente envió en X-Forwarded-For. Debe salir del socket peer real.
 */
describe('OWASP A07 - X-Forwarded-For no es tomado como IP real', () => {
  let app: Express
  let pgContainer: StartedPostgreSqlContainer | null = null
  let redisContainer: StartedTestContainer | null = null
  let pool: Pool | null = null
  let db: AppDatabase | null = null
  let redisClient: AppRedisClient | null = null

  const testRunId = Date.now()
  const bait = {
    email: `owasp.trust.proxy.${testRunId}@example.com`,
    password: 'RealPassword2026!',
  }

  beforeAll(async () => {
    // eslint-disable-next-line no-console
    console.log('\n[OWASP Trust-Proxy] Arrancando contenedores...')

    pgContainer = await new PostgreSqlContainer('postgres:16-alpine').start()
    redisContainer = await new GenericContainer('redis:7-alpine')
      .withExposedPorts(6379)
      .start()

    process.env.DATABASE_URL = pgContainer.getConnectionUri()
    process.env.REDIS_URL = `redis://${redisContainer.getHost()}:${redisContainer.getMappedPort(6379)}`
    // El servidor debe correr con TRUST_PROXY=false por defecto en dev/test.
    process.env.TRUST_PROXY = 'false'

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

    await request(app).post('/auth/register').send(bait).expect(201)
    await db.execute(
      sql`UPDATE users SET status = 'active' WHERE email = ${bait.email}`,
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

  it('la IP registrada en auditoría NO refleja X-Forwarded-For inyectado por el cliente', async () => {
    if (!db) {
      throw new Error('Database is not initialized')
    }

    const spoofedIpA = '1.2.3.4'
    const spoofedIpB = '5.6.7.8'

    // Paso 1 — atacante hace un intento fallido de login inyectando XFF spoof A.
    await request(app)
      .post('/auth/login')
      .set('X-Forwarded-For', spoofedIpA)
      .send({ email: bait.email, password: 'WrongPassword-A' })

    // Paso 2 — segundo intento fallido con XFF distinto (spoof B).
    await request(app)
      .post('/auth/login')
      .set('X-Forwarded-For', spoofedIpB)
      .send({ email: bait.email, password: 'WrongPassword-B' })

    // Paso 3 — leer los eventos de auditoría generados por esos intentos.
    const auditRows = await db.execute(
      sql`SELECT ip_address FROM auth_audit_logs
          WHERE event_type = 'login_failed'
          AND user_id = (SELECT id FROM users WHERE email = ${bait.email})
          ORDER BY created_at ASC`,
    )

    expect(auditRows.rows.length).toBeGreaterThanOrEqual(2)

    // Aseveración de seguridad #1: ninguno de los eventos debe haber
    // registrado la IP inyectada por el cliente.
    for (const row of auditRows.rows) {
      const ip = row.ip_address as string | null
      expect(ip).not.toBe(spoofedIpA)
      expect(ip).not.toBe(spoofedIpB)
    }

    // Aseveración de seguridad #2: como TRUST_PROXY=false, las dos
    // peticiones (que en un test comparten el mismo socket) deben
    // haber quedado atribuidas a la MISMA IP real. Si difieren, es
    // porque el server está usando XFF, y el atacante puede rotarlo.
    const ips = auditRows.rows
      .slice(0, 2)
      .map((row) => (row.ip_address as string | null) ?? '')
    expect(ips[0]).toBe(ips[1])
  })
})
