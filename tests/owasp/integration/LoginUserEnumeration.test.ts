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
 * OWASP A07 - Identification and Authentication Failures
 *
 * Escenario del ataque:
 *   Un atacante quiere saber qué correos están registrados en la
 *   plataforma (para phishing dirigido, spraying de contraseñas, etc.).
 *   Prueba /auth/login con una contraseña cualquiera contra distintos
 *   correos y observa la respuesta del servidor.
 *
 * Propiedad de seguridad que este test verifica:
 *   El endpoint de login debe responder de forma indistinguible ante
 *   "email inexistente" y "email existente con contraseña incorrecta".
 *   Si las respuestas se diferencian (código, mensaje, o presencia de
 *   cookies), el atacante puede enumerar cuentas válidas.
 */
describe('OWASP A07 - Enumeración de usuarios en /auth/login', () => {
  let app: Express
  let pgContainer: StartedPostgreSqlContainer | null = null
  let redisContainer: StartedTestContainer | null = null
  let pool: Pool | null = null
  let db: AppDatabase | null = null
  let redisClient: AppRedisClient | null = null

  const testRunId = Date.now()
  const registeredUser = {
    email: `owasp.enum.real.${testRunId}@example.com`,
    password: 'RealUserPassword2026!',
  }
  const nonexistentEmail = `owasp.enum.ghost.${testRunId}@example.com`
  const attackerGuess = 'AttackerGuess2026!'

  beforeAll(async () => {
    // eslint-disable-next-line no-console
    console.log('\n[OWASP Enum] Arrancando contenedores PostgreSQL y Redis...')

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

    // Registrar y activar el usuario real que servirá como cebo.
    await request(app).post('/auth/register').send(registeredUser).expect(201)
    await db.execute(
      sql`UPDATE users SET status = 'active' WHERE email = ${registeredUser.email}`,
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

  it('el atacante NO puede distinguir un email registrado de uno inexistente', async () => {
    // Paso 1 — atacante prueba un email que SÍ existe con contraseña incorrecta.
    const responseForRealAccount = await request(app).post('/auth/login').send({
      email: registeredUser.email,
      password: attackerGuess,
    })

    // Paso 2 — atacante prueba un email que NO existe con la misma contraseña.
    const responseForFakeAccount = await request(app).post('/auth/login').send({
      email: nonexistentEmail,
      password: attackerGuess,
    })

    // Aseveración de seguridad: ambas respuestas deben ser indistinguibles.
    expect(responseForRealAccount.status).toBe(401)
    expect(responseForFakeAccount.status).toBe(401)

    expect(responseForRealAccount.body.error.code).toBe('UNAUTHORIZED')
    expect(responseForFakeAccount.body.error.code).toBe('UNAUTHORIZED')

    // El mensaje es el vector principal de fuga: si difiere entre casos,
    // el atacante ya sabe si el email existe.
    expect(responseForRealAccount.body.error.message).toBe(
      responseForFakeAccount.body.error.message,
    )

    // Ninguna respuesta debe incluir cookies de sesión.
    expect(responseForRealAccount.headers['set-cookie']).toBeUndefined()
    expect(responseForFakeAccount.headers['set-cookie']).toBeUndefined()
  })
})
