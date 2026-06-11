/* eslint-disable no-console */
import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { GenericContainer, type StartedTestContainer } from 'testcontainers'

describe('Login & Refresh Flow Integration', () => {
    let app: Express
    let redisClient: any
    let pgContainer: StartedPostgreSqlContainer
    let redisContainer: StartedTestContainer

    const testUser = {
        email: `login.flow.${Date.now()}@example.com`,
        password: 'SecurePassword2026!',
    }

    let validCookies: string[] = []
    let oldCookies: string[] = []

    beforeAll(async () => {
        console.log('\n[LOGIN FLOW] Arrancando contenedores para pruebas de integración...')

        // Iniciamos los contenedores
        pgContainer = await new PostgreSqlContainer('postgres:16-alpine').start()
        redisContainer = await new GenericContainer('redis:7-alpine').withExposedPorts(6379).start()

        // Inyectamos variables de entorno antes de importar la app
        process.env.DATABASE_URL = pgContainer.getConnectionUri()
        process.env.REDIS_URL = `redis://${redisContainer.getHost()}:${redisContainer.getMappedPort(6379)}`

        // Realizamos imports
        const { pool } = await import('@/infrastructure/db/db.js')
        const { drizzle } = await import('drizzle-orm/node-postgres')
        const { migrate } = await import('drizzle-orm/node-postgres/migrator')
        const { sql } = await import('drizzle-orm')
        const { createApp } = await import('@/app.js')
        const { container } = await import('@/container/inversify.config.js')
        const { TYPES } = await import('@/container/types.js')

        // Corremos las migraciones en el PostgreSQL
        const db = drizzle({ client: pool })
        await migrate(db, { migrationsFolder: './drizzle' })

        // Conectamos Redis e iniciamos la App
        redisClient = container.get(TYPES.RedisClient)
        if (!redisClient.isOpen) await redisClient.connect()

        app = createApp(container)

        // Registramos al usuario en el sistema
        await request(app).post('/auth/register').send(testUser)

        // Dejamos en estado activo al usuario
        await db.execute(sql`UPDATE users SET status = 'active' WHERE email = ${testUser.email}`)

        console.log('[LOGIN FLOW] Setup completado.')
    }, 120000)

    afterAll(async () => {
        console.log('\n[LOGIN FLOW] Limpiando contenedores...')
        const { pool } = await import('@/infrastructure/db/db.js')
        await pool.end()
        if (redisClient?.isOpen) await redisClient.disconnect()
        if (pgContainer) await pgContainer.stop()
        if (redisContainer) await redisContainer.stop()
    })

    it('POST /auth/login -> invalido (401)', async () => {
        const response = await request(app)
            .post('/auth/login')
            .send({ email: testUser.email, password: 'WrongPassword123!' })

        expect(response.status).toBe(401)
    })

    it('POST /auth/login -> exitoso (200 + cookies auth)', async () => {
        const response = await request(app)
            .post('/auth/login')
            .send(testUser)

        expect(response.status).toBe(200)

        const cookies = response.headers['set-cookie'] as string[] | undefined

        expect(cookies).toBeDefined()
        if (!cookies) throw new Error('No se recibieron cookies')

        expect(cookies.some((c) => c.includes('access_token='))).toBe(true)
        expect(cookies.some((c) => c.includes('refresh_token='))).toBe(true)

        validCookies = cookies
    })

    it('POST /auth/refresh -> sin cookie (401)', async () => {
        const response = await request(app).post('/auth/refresh')

        expect(response.status).toBe(401)
    })

    it('POST /auth/refresh -> valido (200 + rotacion de cookies)', async () => {
        oldCookies = [...validCookies]

        const response = await request(app)
            .post('/auth/refresh')
            .set('Cookie', validCookies)

        expect(response.status).toBe(200)

        const newCookies = response.headers['set-cookie'] as string[] | undefined

        expect(newCookies).toBeDefined()
        if (!newCookies) throw new Error('No se recibieron cookies en el refresh')

        expect(newCookies.some((c) => c.includes('access_token='))).toBe(true)
        expect(newCookies.some((c) => c.includes('refresh_token='))).toBe(true)

        validCookies = newCookies
    })

    it('POST /auth/refresh -> invalido/revocado (401)', async () => {
        const response = await request(app)
            .post('/auth/refresh')
            .set('Cookie', oldCookies)

        expect(response.status).toBe(401)
    })
})