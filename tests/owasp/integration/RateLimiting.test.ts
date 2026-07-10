import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { createApp } from '@/app.js'
import { container } from '@/container/inversify.config.js'
import { TYPES } from '@/container/types.js'
import type { AppRedisClient } from '@/infrastructure/redis.js'

describe('OWASP - Protección de Rate Limiting (Brute Force Protection)', () => {
  let app: Express
  let simulatedHits = 1

  beforeAll(async () => {
    // Re-vincular (mockear) el cliente de Redis para controlar dinámicamente los hits
    const binding = await container.rebind<AppRedisClient>(TYPES.RedisClient)
    binding.toConstantValue({
      sendCommand: async (command: string[]) => {
        // Si express-rate-limit carga/verifica los scripts de Redis (ej. SCRIPT EXISTS o SCRIPT LOAD)
        if (command[0] === 'SCRIPT') {
          return 'mock-sha-hash'
        }
        // Simular la respuesta del script Lua de rate-limit-redis.
        // Retorna un array en formato: [totalHits, timeToResetMs]
        return [simulatedHits, 60000]
      },
    } as unknown as AppRedisClient)

    app = createApp(container)
  })

  it('debe permitir la solicitud cuando no se excede el límite de rate limit', async () => {
    // Simulamos que el cliente lleva solo 1 petición (menor al límite de 100)
    simulatedHits = 1

    const response = await request(app)
      .get('/does-not-exist-route') // Usamos una ruta inexistente para evitar dependencias
      .send()

    // No debe lanzar un error 429, debería retornar 404
    expect(response.status).toBe(404)
  })

  it('debe bloquear la solicitud con 429 (Too Many Requests) cuando se excede el límite', async () => {
    // Forzamos el error simulando que el cliente ya excedió el límite (101 peticiones)
    simulatedHits = 101

    const response = await request(app).get('/does-not-exist-route').send()

    // Aseveraciones de seguridad para forzar el error (OWASP A07:2021)
    expect(response.status).toBe(429)
    expect(response.body).toBeDefined()
    expect(response.body.error).toBeDefined()
    expect(response.body.error.code).toBe('RATE_LIMIT_EXCEEDED')
    expect(response.body.error.message).toBe('Too many requests')
    expect(response.body.error.requestId).toBeDefined()
  })
})
