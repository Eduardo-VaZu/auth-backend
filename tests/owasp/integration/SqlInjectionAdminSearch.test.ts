import { sql } from 'drizzle-orm'
import type { Pool } from 'pg'
import type { Express } from 'express'
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql'
import { GenericContainer, type StartedTestContainer } from 'testcontainers'
import request from 'supertest'
import { describe, expect, it, beforeAll, afterAll } from 'vitest'

import type { AppDatabase } from '@/infrastructure/db/db.js'
import type { AppRedisClient } from '@/infrastructure/redis.js'
import type { IUserRepository } from '@/modules/identity/domain/repositories/IUserRepository.js'

/**
 * OWASP A03 - Injection (SQL)
 *
 * Escenario del ataque:
 *   Un administrador (o cualquier consumidor con permisos suficientes)
 *   usa la búsqueda de usuarios de /admin/users?q=<término>. Si el
 *   backend construye la consulta concatenando string literal en vez
 *   de parametrizarlo, un atacante puede terminar la cláusula
 *   original, agregar SQL adicional y ejecutar comandos destructivos
 *   (`DROP TABLE`, `UPDATE ... SET status = ...`, etc.).
 *
 * Propiedad de seguridad que este test verifica:
 *   Frente a un payload clásico de SQLi como término de búsqueda:
 *     - La consulta no arroja error del motor.
 *     - La tabla `users` conserva TODOS los registros previos.
 *     - El resultado devuelto trata el payload como texto literal
 *       (0 coincidencias) y no como código SQL.
 */
describe('OWASP A03 - SQL injection en búsqueda de usuarios (admin)', () => {
  let app: Express
  let pgContainer: StartedPostgreSqlContainer | null = null
  let redisContainer: StartedTestContainer | null = null
  let pool: Pool | null = null
  let db: AppDatabase | null = null
  let redisClient: AppRedisClient | null = null
  let userRepository: IUserRepository | null = null

  const testRunId = Date.now()
  const seedUsers = [
    { email: `owasp.sqli.a.${testRunId}@example.com`, password: 'Password1!' },
    { email: `owasp.sqli.b.${testRunId}@example.com`, password: 'Password1!' },
    { email: `owasp.sqli.c.${testRunId}@example.com`, password: 'Password1!' },
  ]

  const sqliPayload = "%'); DROP TABLE users; --"

  beforeAll(async () => {
    // eslint-disable-next-line no-console
    console.log('\n[OWASP SQLi] Arrancando contenedores...')

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
    userRepository = containerModule.container.get<IUserRepository>(
      typesModule.TYPES.IUserRepository,
    )

    // Semilla: tres usuarios legítimos.
    for (const seed of seedUsers) {
      await request(app).post('/auth/register').send(seed).expect(201)
    }
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

  it('un payload SQLi como término de búsqueda es tratado como texto, no como código', async () => {
    if (!db || !userRepository) {
      throw new Error('Test setup incomplete')
    }

    // Paso 1 — snapshot del estado ANTES del intento de inyección.
    const totalBefore = await db.execute(
      sql`SELECT COUNT(*)::int AS n FROM users`,
    )
    const beforeRow = totalBefore.rows[0]
    expect(beforeRow).toBeDefined()
    if (!beforeRow) {
      throw new Error('Total row before missing')
    }
    const usersBefore = beforeRow.n as number
    expect(usersBefore).toBeGreaterThanOrEqual(seedUsers.length)

    // Paso 2 — EL ATAQUE: la búsqueda recibe un payload SQLi.
    // Ejercemos directamente el mismo método que consume el controller
    // /admin/users, sin necesidad de credenciales admin.
    const result = await userRepository.listPaginated({
      limit: 20,
      offset: 0,
      search: sqliPayload,
    })

    // Aseveración de seguridad #1: la consulta no tira excepción del
    // motor. La ejecución llegó hasta el `return` sin errores.
    expect(result).toBeDefined()

    // Aseveración de seguridad #2: el payload NO fue interpretado
    // como SQL — la tabla `users` sigue existiendo y con la misma
    // cantidad de filas.
    const totalAfter = await db.execute(
      sql`SELECT COUNT(*)::int AS n FROM users`,
    )
    const afterRow = totalAfter.rows[0]
    expect(afterRow).toBeDefined()
    if (!afterRow) {
      throw new Error('Total row after missing')
    }
    expect(afterRow.n).toBe(usersBefore)

    // Aseveración de seguridad #3: como texto literal, el payload no
    // matchea con ningún email conocido — el resultado tiene 0 usuarios.
    expect(result.users.length).toBe(0)
    expect(result.total).toBe(0)
  })
})
