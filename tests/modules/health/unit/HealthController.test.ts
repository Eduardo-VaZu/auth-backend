import { describe, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'
import { HealthController } from '@/modules/health/HealthController.js'
import * as dbModule from '../../../../src/infrastructure/db/db.js'
import * as redisModule from '../../../../src/infrastructure/redis.js'

describe('HealthController', () => {
  it('returns 200 when PostgreSQL and Redis are ok', async () => {
    const pgSpy = vi.spyOn(dbModule, 'checkPostgresHealth').mockResolvedValue({ status: 'ok', latencyMs: 10 })
    const redisSpy = vi.spyOn(redisModule, 'checkRedisHealth').mockResolvedValue({ status: 'ok', latencyMs: 5 })

    const controller = new HealthController()
    
    // Tipamos el mock de la respuesta usando Partial<Response>
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response

    await controller.getStatus({} as Request, res)

    expect(res.status).toHaveBeenCalledWith(200)

    pgSpy.mockRestore()
    redisSpy.mockRestore()
  })

  it('returns 503 when a dependency fails', async () => {
    const pgSpy = vi.spyOn(dbModule, 'checkPostgresHealth').mockResolvedValue({ status: 'error', latencyMs: 100 })
    const redisSpy = vi.spyOn(redisModule, 'checkRedisHealth').mockResolvedValue({ status: 'ok', latencyMs: 5 })

    const controller = new HealthController()
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response

    await controller.getStatus({} as Request, res)

    expect(res.status).toHaveBeenCalledWith(503)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'degraded' }))

    pgSpy.mockRestore()
    redisSpy.mockRestore()
  })
})