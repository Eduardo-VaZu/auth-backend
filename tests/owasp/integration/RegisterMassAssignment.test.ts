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
 * OWASP A04 - Insecure Design / A08 - Software and Data Integrity Failures
 *
 * Escenario del ataque (mass assignment):
 *   Un usuario anónimo se registra por el endpoint público y agrega
 *   campos que deberían ser controlados solo por el servidor:
 *     { email, password, role: "admin", status: "active" }
 *   Si el backend confía en la petición y persiste esos campos, el
 *   atacante queda como administrador activo sin verificar su correo.
 *
 * Propiedad de seguridad que este test verifica:
 *   Los campos `role` y `status` NUNCA deben ser tomados del cuerpo del
 *   request. El servidor debe forzar `role='user'` y
 *   `status='pending_verification'` para todo registro público.
 */
describe('OWASP A04/A08 - Mass assignment en /auth/register', () => {
  let app: Express
  let pgContainer: StartedPostgreSqlContainer | null = null
  let redisContainer: StartedTestContainer | null = null
  let pool: Pool | null = null
  let db: AppDatabase | null = null
  let redisClient: AppRedisClient | null = null

  const testRunId = Date.now()
  const attacker = {
    email: `owasp.mass.attacker.${testRunId}@example.com`,
    password: 'AttackerPassword2026!',
  }

  beforeAll(async () => {
    // eslint-disable-next-line no-console
    console.log('\n[OWASP Mass] Arrancando contenedores PostgreSQL y Redis...')

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

  it('el atacante NO puede autoconcederse rol admin ni saltarse la verificación de email', async () => {
    if (!db) {
      throw new Error('Database is not initialized')
    }

    // Paso 1 — el atacante intenta registrarse pidiendo privilegios elevados
    // y estado ya activo. El servidor debería aceptar el registro pero
    // ignorar los campos `role` y `status` del cuerpo.
    const registrationResponse = await request(app).post('/auth/register').send({
      email: attacker.email,
      password: attacker.password,
      role: 'admin',
      status: 'active',
    })

    // El registro puede aceptarse (201, si el server descarta los campos
    // extra en silencio) o rechazarse (400/422, si el schema los rechaza),
    // pero en cualquier escenario seguro el resultado NUNCA debe ser una
    // cuenta admin+active persistida.
    expect([201, 400, 422]).toContain(registrationResponse.status)

    // Paso 2 — inspección directa de la base para ver qué se persistió.
    const dbUserQuery = await db.execute(
      sql`SELECT status FROM users WHERE email = ${attacker.email}`,
    )
    const userRow = dbUserQuery.rows[0]

    if (userRow) {
      // Si se creó, DEBE haber quedado como usuario pendiente de verificación.
      expect(userRow.status).toBe('pending_verification')

      const rolesQuery = await db.execute(
        sql`SELECT r.name FROM roles r
            JOIN user_roles ur ON ur.role_id = r.id
            JOIN users u ON u.id = ur.user_id
            WHERE u.email = ${attacker.email}`,
      )
      const roleNames = rolesQuery.rows.map((row) => row.name as string)

      // Aseveración de seguridad: nunca debe existir un rol 'admin'
      // asignado a una cuenta creada por auto-registro público.
      expect(roleNames).not.toContain('admin')
    }

    // Paso 3 — el atacante intenta iniciar sesión de inmediato. Con
    // status='pending_verification', el login debe fallar hasta verificar.
    const loginResponse = await request(app).post('/auth/login').send({
      email: attacker.email,
      password: attacker.password,
    })

    expect(loginResponse.status).not.toBe(200)
    expect(loginResponse.headers['set-cookie']).toBeUndefined()
  })
})
