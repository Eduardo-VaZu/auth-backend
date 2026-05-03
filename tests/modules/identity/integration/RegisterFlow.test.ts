import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { createApp } from '@/app.js'
import { container } from '@/container/inversify.config.js'
import { TYPES } from '@/container/types.js'
import type { AppRedisClient } from '@/infrastructure/redis.js'

describe('Register Flow Integration', () => {
  let app: Express
  let redisClient: AppRedisClient

  beforeAll(async () => {
    // Obtenemos el cliente con su tipo real
    redisClient = container.get<AppRedisClient>(TYPES.RedisClient)

    if (!redisClient.isOpen) {
      await redisClient.connect()
    }

    // Creamos la app pasando el container tipado
    app = createApp(container)
  })

  afterAll(async () => {
    if (redisClient.isOpen) {
      await redisClient.disconnect()
    }
  })

  it('POST /auth/register -> creates user and returns 201', async () => {
    const uniqueEmail = `lincolm.test.${Date.now()}@example.com`

    const response = await request(app).post('/auth/register').send({
      email: uniqueEmail,
      password: 'SecurePassword123!',
    })

    expect(response.status).toBe(201)
    expect(response.body).toHaveProperty('verificationRequired', true)
  })

  it('GET /auth/me -> returns 401 if not logged in', async () => {
    const response = await request(app).get('/auth/me')
    expect(response.status).toBe(401)
  })
})
