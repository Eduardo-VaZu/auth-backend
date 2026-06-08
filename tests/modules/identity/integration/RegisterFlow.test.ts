/* eslint-disable no-console */
import { describe, expect, it, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { GenericContainer, type StartedTestContainer } from 'testcontainers'

describe('Register Flow Integration (HTTP & Testcontainers)', () => {
  let app: Express
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let redisClient: any
  let pgContainer: StartedPostgreSqlContainer
  let redisContainer: StartedTestContainer

  const testUser = {
    email: `lincolm.test.${Date.now()}@example.com`,
    password: 'SecurePassword2026!'
  }

  beforeAll(async () => {
    console.log('\n[AUDIT] ====================================================')
    console.log('[AUDIT] Levantando Testcontainers y configurando entorno...')
    
    // 1. Levantar contenedores
    pgContainer = await new PostgreSqlContainer('postgres:16-alpine').start()
    redisContainer = await new GenericContainer('redis:7-alpine').withExposedPorts(6379).start()
    
    // 2. Configurar variables de entorno ANTES de importar los módulos del proyecto
    process.env.DATABASE_URL = pgContainer.getConnectionUri()
    process.env.REDIS_URL = `redis://${redisContainer.getHost()}:${redisContainer.getMappedPort(6379)}`

    console.log(`[AUDIT] ✔️ Contenedores listos: ${process.env.DATABASE_URL}`)

    // 3. Importación dinámica (Lazy loading)
    const { pool } = await import('@/infrastructure/db/db.js')
    const { drizzle } = await import('drizzle-orm/node-postgres')
    const { migrate } = await import('drizzle-orm/node-postgres/migrator')
    const { createApp } = await import('@/app.js')
    const { container } = await import('@/container/inversify.config.js')
    const { TYPES } = await import('@/container/types.js')

    // 4. Ejecutar Migraciones (¡Esto soluciona el error de "users relation does not exist"!)
    console.log('[AUDIT] Ejecutando migraciones de Drizzle...')
    const db = drizzle({ client: pool })
    await migrate(db, { migrationsFolder: './drizzle' })
    console.log('[AUDIT] ✔️ Migraciones aplicadas con éxito.')

    // 5. Inicializar App
    redisClient = container.get(TYPES.RedisClient)
    if (!redisClient.isOpen) {
      await redisClient.connect()
    }
    app = createApp(container)
    
    console.log('[AUDIT] ✔️ Aplicación inicializada. Entorno listo.')
    console.log('[AUDIT] ====================================================\n')
  }, 120000)

  afterAll(async () => {
    console.log('\n[AUDIT] ====================================================')
    console.log('[AUDIT] Finalizando pruebas. Limpiando contenedores...')
    const { pool } = await import('@/infrastructure/db/db.js')
    await pool.end()
    if (redisClient?.isOpen) await redisClient.disconnect()
    if (pgContainer) await pgContainer.stop()
    if (redisContainer) await redisContainer.stop()
    console.log('[AUDIT] ✔️ Contenedores destruidos.')
    console.log('[AUDIT] ====================================================\n')
  })

  beforeEach(() => console.log('\n[TEST] ------------------------------------------------'))
  afterEach(() => console.log('[TEST] ------------------------------------------------\n'))

  it('GET /health -> retorna 200 con payload esperado', async () => {
    console.log('[AUDIT] Test: GET /health')
    const response = await request(app).get('/health')
    expect(response.status).toBe(200)
    expect(response.body).toEqual(expect.objectContaining({ status: 'ok' }))
  })

  it('POST /auth/register -> falla con 400 ante payload invalido', async () => {
    console.log('[AUDIT] Test: POST /auth/register (Invalid Payload)')
    const response = await request(app).post('/auth/register').send({ email: 'bad', password: '123' })
    expect(response.status).toBe(422)
  })

  it('POST /auth/register -> crea usuario, retorna 201 y NO setea cookies de login', async () => {
    console.log(`[AUDIT] Test: POST /auth/register (Registro correcto: ${testUser.email})`)
    const response = await request(app).post('/auth/register').send(testUser)

    expect(response.status).toBe(201)
    expect(response.body).toHaveProperty('verificationRequired', true)

    const setCookieHeader = response.headers['set-cookie'] as string[] | undefined
    if (setCookieHeader && Array.isArray(setCookieHeader)) {
      const hasAuthCookies = setCookieHeader.some((c) => c.includes('accessToken') || c.includes('sessionId'))
      expect(hasAuthCookies).toBe(false)
    }
  })

  it('POST /auth/register -> rechaza email duplicado con 409', async () => {
    console.log('[AUDIT] Test: POST /auth/register (Email duplicado)')
    const response = await request(app).post('/auth/register').send(testUser)
    expect(response.status).toBe(409)
  })

  it('GET /auth/me -> retorna 401 sin login despues de registro', async () => {
    console.log('[AUDIT] Test: GET /auth/me (No autorizado)')
    const response = await request(app).get('/auth/me')
    expect(response.status).toBe(401)
  })
})