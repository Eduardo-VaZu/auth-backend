import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { createApp } from '@/app.js'
import { container } from '@/container/inversify.config.js'
import { TYPES } from '@/container/types.js'
import type { AppRedisClient } from '@/infrastructure/redis.js'

describe('OWASP - Login malicious payload rejection', () => {
  let app: Express

  beforeAll(async () => {
    // Mock de Redis
    const binding = await container.rebind<AppRedisClient>(TYPES.RedisClient)
    binding.toConstantValue({
      sendCommand: async (command: string[]) => {
        if (command[0] === 'SCRIPT') return 'mock-sha-hash'
        return [1, 60000]
      },
    } as unknown as AppRedisClient)

    app = createApp(container)
  })

  it('debe rechazar payloads maliciosos mediante validacion de esquema', async () => {
    const maliciousPayload = {
      email: "admin' OR '1'='1",
      password: 'password123',
    }

    const response = await request(app)
      .post('/auth/login')
      .send(maliciousPayload)

    expect(response.status).toBe(422)
  })
})
