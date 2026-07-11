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
 * OWASP A01 - Broken Access Control (IDOR)
 *
 * Escenario del ataque:
 *   El usuario A tiene una cuenta legítima y una sesión activa. Quiere
 *   apoderarse de la cuenta del usuario B (por ejemplo, para tomar
 *   posesión mediante el flujo de recuperación de contraseña).
 *   Envía PATCH /auth/me/email desde su propia sesión, pero con el
 *   userId de B en el cuerpo:
 *     { userId: "<B-id>", email: "attacker@evil.tld" }
 *
 * Propiedad de seguridad que este test verifica:
 *   La identidad del usuario a modificar SIEMPRE debe salir del token
 *   autenticado, nunca del cuerpo. Si el servidor confía en el body,
 *   cualquier usuario con sesión válida puede modificar la cuenta de
 *   otro.
 */
describe('OWASP A01 - IDOR en PATCH /auth/me/email', () => {
  let app: Express
  let pgContainer: StartedPostgreSqlContainer | null = null
  let redisContainer: StartedTestContainer | null = null
  let pool: Pool | null = null
  let db: AppDatabase | null = null
  let redisClient: AppRedisClient | null = null

  const testRunId = Date.now()
  const attacker = {
    email: `owasp.idor.email.a.${testRunId}@example.com`,
    password: 'AttackerPassword2026!',
  }
  const victim = {
    email: `owasp.idor.email.b.${testRunId}@example.com`,
    password: 'VictimPassword2026!',
  }
  const attackerTargetEmail = `owasp.hijacked.${testRunId}@evil.tld`

  beforeAll(async () => {
    // eslint-disable-next-line no-console
    console.log('\n[OWASP IDOR-Email] Arrancando contenedores...')

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

    // Registrar y activar ambos usuarios.
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

  it('el atacante NO puede cambiar el email de otra cuenta usando el userId ajeno en el body', async () => {
    if (!db) {
      throw new Error('Database is not initialized')
    }

    // Paso 1 — el atacante inicia sesión con su propia cuenta.
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

    // Paso 2 — el atacante obtiene el userId de la víctima. En un
    // escenario real, este id podría filtrarse por logs, urls, otros
    // endpoints IDOR, o simplemente por ser un uuid con enumeración.
    // Aquí lo leemos directamente para simular ese conocimiento.
    const victimRowQuery = await db.execute(
      sql`SELECT id FROM users WHERE email = ${victim.email}`,
    )
    const victimRow = victimRowQuery.rows[0]
    expect(victimRow).toBeDefined()
    if (!victimRow) {
      throw new Error('Victim row missing')
    }
    const victimUserId = victimRow.id as string

    // Paso 3 — EL ATAQUE: el atacante envía PATCH /auth/me/email con
    // el userId de la víctima en el cuerpo. Un servidor seguro debe
    // ignorar por completo ese campo y (o bien) actuar sobre el
    // propio email del atacante, (o bien) rechazar la petición.
    const attackResponse = await request(app)
      .patch('/auth/me/email')
      .set('Cookie', attackerCookies)
      .send({
        userId: victimUserId,
        email: attackerTargetEmail,
      })

    // Aseveración de seguridad #1: el email real de la víctima
    // en la base de datos NO cambió.
    const victimEmailAfter = await db.execute(
      sql`SELECT email FROM users WHERE id = ${victimUserId}`,
    )
    const victimEmailRow = victimEmailAfter.rows[0]
    expect(victimEmailRow).toBeDefined()
    if (!victimEmailRow) {
      throw new Error('Victim row missing after attack')
    }
    expect(victimEmailRow.email).toBe(victim.email)

    // Aseveración de seguridad #2: el email hijacked no aparece en
    // ninguna cuenta (nadie quedó con "attacker@evil.tld").
    const hijackedQuery = await db.execute(
      sql`SELECT COUNT(*)::int AS n FROM users WHERE email = ${attackerTargetEmail}`,
    )
    const hijackedRow = hijackedQuery.rows[0]
    expect(hijackedRow).toBeDefined()
    if (!hijackedRow) {
      throw new Error('Count row missing')
    }
    expect(hijackedRow.n).toBe(0)

    // Aseveración de seguridad #3: la sesión del atacante puede
    // haber quedado invalidada (si el servidor procesó el cambio
    // sobre su propia cuenta) o la petición puede haber sido
    // rechazada. Lo NO aceptable es status 200 con la mutación
    // aplicada sobre la víctima, cosa ya cubierta arriba.
    expect(attackResponse.status).toBeLessThan(500)
  })
})
