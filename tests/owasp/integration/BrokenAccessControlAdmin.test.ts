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
 * OWASP A01 - Broken Access Control
 *
 * Escenario del ataque:
 *   Un usuario común (sin rol de administrador) descubre — o
 *   simplemente prueba — que puede llamar directamente al endpoint
 *   administrativo de eliminación de cuentas:
 *     DELETE /admin/users/<id>
 *   Si el servidor solo verifica que "haya sesión" pero no verifica
 *   "quién puede llamar este endpoint", el atacante logra eliminar
 *   (soft-delete) cuentas ajenas sin tener privilegios.
 *
 * Propiedad de seguridad que este test verifica:
 *   Los endpoints bajo /admin/* deben rechazar (403) toda llamada
 *   hecha por usuarios sin rol admin, incluso si están correctamente
 *   autenticados. La base de datos no debe reflejar el efecto de la
 *   acción intentada.
 */
describe('OWASP A01 - Control de acceso roto en /admin/users/:userId', () => {
  let app: Express
  let pgContainer: StartedPostgreSqlContainer | null = null
  let redisContainer: StartedTestContainer | null = null
  let pool: Pool | null = null
  let db: AppDatabase | null = null
  let redisClient: AppRedisClient | null = null

  const testRunId = Date.now()
  const attacker = {
    email: `owasp.bac.attacker.${testRunId}@example.com`,
    password: 'AttackerPassword2026!',
  }
  const victim = {
    email: `owasp.bac.victim.${testRunId}@example.com`,
    password: 'VictimPassword2026!',
  }

  beforeAll(async () => {
    // eslint-disable-next-line no-console
    console.log('\n[OWASP BAC-Admin] Arrancando contenedores...')

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

    // Registrar y activar ambas cuentas. Ninguna de las dos tiene rol admin.
    await request(app).post('/auth/register').send(attacker).expect(201)
    await request(app).post('/auth/register').send(victim).expect(201)
    await db.execute(
      sql`UPDATE users SET status = 'active' WHERE email IN (${attacker.email}, ${victim.email})`,
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

  it('un usuario NO admin NO puede eliminar cuentas ajenas vía DELETE /admin/users/:userId', async () => {
    if (!db) {
      throw new Error('Database is not initialized')
    }

    // Paso 1 — atacante inicia sesión con su cuenta común.
    const attackerLogin = await request(app)
      .post('/auth/login')
      .send(attacker)
      .expect(200)
    const attackerCookies = attackerLogin.headers['set-cookie'] as
      | string[]
      | undefined

    expect(attackerCookies).toBeDefined()
    if (!attackerCookies) {
      throw new Error('Attacker cookies missing')
    }

    // Paso 2 — descubrimos el userId de la víctima (simula filtración).
    const victimRowQuery = await db.execute(
      sql`SELECT id FROM users WHERE email = ${victim.email}`,
    )
    const victimRow = victimRowQuery.rows[0]
    expect(victimRow).toBeDefined()
    if (!victimRow) {
      throw new Error('Victim row missing')
    }
    const victimUserId = victimRow.id as string

    // Paso 3 — EL ATAQUE: usuario sin rol admin llama al endpoint
    // administrativo de soft-delete apuntando a la víctima.
    const attackResponse = await request(app)
      .delete(`/admin/users/${victimUserId}`)
      .set('Cookie', attackerCookies)

    // Aseveración de seguridad #1: el servidor debe rechazar por
    // autorización insuficiente. 403 es el código canónico.
    expect(attackResponse.status).toBe(403)

    // Aseveración de seguridad #2: la víctima NO fue eliminada
    // en la base de datos. deleted_at debe seguir siendo NULL.
    const afterQuery = await db.execute(
      sql`SELECT deleted_at, status FROM users WHERE id = ${victimUserId}`,
    )
    const afterRow = afterQuery.rows[0]
    expect(afterRow).toBeDefined()
    if (!afterRow) {
      throw new Error('Victim row missing after attack')
    }
    expect(afterRow.deleted_at).toBeNull()
    expect(afterRow.status).toBe('active')
  })
})
