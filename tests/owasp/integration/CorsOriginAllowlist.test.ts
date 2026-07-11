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
 * OWASP A05 - Security Misconfiguration (CORS)
 *
 * Escenario del ataque (CORS reflection + credentials):
 *   Un atacante publica un sitio malicioso (por ejemplo, evil.tld)
 *   y engaña a un usuario logueado en nuestra plataforma para que
 *   lo visite. Desde JavaScript en evil.tld, hace fetch a nuestra
 *   API con `credentials: 'include'`. Si nuestro servidor devuelve
 *   `Access-Control-Allow-Origin: https://evil.tld` +
 *   `Access-Control-Allow-Credentials: true`, el navegador entrega
 *   la respuesta al script atacante junto con las cookies de sesión
 *   del usuario. Fuga completa desde el navegador de la víctima.
 *
 * Propiedad de seguridad que este test verifica:
 *   La política CORS debe operar como allowlist estricta. Cualquier
 *   Origin que no esté en la lista de orígenes autorizados debe ser
 *   rechazado ANTES de que el servidor procese la petición.
 */
describe('OWASP A05 - Política CORS con allowlist estricta', () => {
  let app: Express
  let pgContainer: StartedPostgreSqlContainer | null = null
  let redisContainer: StartedTestContainer | null = null
  let pool: Pool | null = null
  let db: AppDatabase | null = null
  let redisClient: AppRedisClient | null = null

  beforeAll(async () => {
    // eslint-disable-next-line no-console
    console.log('\n[OWASP CORS] Arrancando contenedores...')

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

  it('un Origin no permitido es rechazado con 403 y sin headers CORS con credentials', async () => {
    const hostileOrigin = 'https://evil.tld'

    // Paso 1 — el atacante simula una petición desde su dominio.
    // Cualquier endpoint sirve; usamos /auth/login para ejercer POST.
    const response = await request(app)
      .post('/auth/login')
      .set('Origin', hostileOrigin)
      .send({
        email: 'someone@example.com',
        password: 'IrrelevantPassword2026!',
      })

    // Aseveración de seguridad #1: la política CORS rechaza el origen
    // con un ForbiddenError (403). La petición nunca llega al handler
    // de login, así que el password inválido nunca es evaluado.
    expect(response.status).toBe(403)

    // Aseveración de seguridad #2: la respuesta NO refleja el Origin
    // hostil en Access-Control-Allow-Origin. Reflejar Origin arbitrarios
    // junto con Access-Control-Allow-Credentials: true es la
    // configuración exacta que habilita el robo de sesión desde el
    // navegador de la víctima.
    expect(response.headers['access-control-allow-origin']).not.toBe(
      hostileOrigin,
    )
  })

  it('un Origin permitido en la allowlist pasa el chequeo CORS', async () => {
    // Un origen que sí está en env.CORS_ORIGIN (definido en tests/setup.ts).
    const allowedOrigin = 'http://localhost:5173'

    const response = await request(app)
      .post('/auth/login')
      .set('Origin', allowedOrigin)
      .send({
        email: 'someone@example.com',
        password: 'IrrelevantPassword2026!',
      })

    // El login falla por credenciales inválidas, pero el CORS pasa.
    // El servidor debe reflejar SÓLO orígenes de la lista.
    expect(response.status).not.toBe(403)
    expect(response.headers['access-control-allow-origin']).toBe(allowedOrigin)
  })
})
