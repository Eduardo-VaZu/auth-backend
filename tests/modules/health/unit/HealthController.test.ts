import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Request, Response } from 'express'
import { HealthController } from '@/modules/health/HealthController.js'
import * as dbModule from '../../../../src/infrastructure/db/db.js'
import * as redisModule from '../../../../src/infrastructure/redis.js'

describe('HealthController', () => {
  let req: Partial<Request>
  let res: Partial<Response>

  beforeEach(() => {
    req = {}
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    }
  })

  it('returns 200 when PostgreSQL and Redis are ok, and payload includes status, timestamp, uptime, dependencies', async () => {
    const pgSpy = vi
      .spyOn(dbModule, 'checkPostgresHealth')
      .mockResolvedValue({ status: 'ok', latencyMs: 10 })
    const redisSpy = vi
      .spyOn(redisModule, 'checkRedisHealth')
      .mockResolvedValue({ status: 'ok', latencyMs: 5 })

    const controller = new HealthController()
    await controller.getStatus(req as Request, res as Response)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ok',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        dependencies: {
          postgres: { status: 'ok', latencyMs: 10 },
          redis: { status: 'ok', latencyMs: 5 },
        },
      }),
    )

    pgSpy.mockRestore()
    redisSpy.mockRestore()
  })

  it('returns 503 when PostgreSQL fails and Redis is ok', async () => {
    const pgSpy = vi
      .spyOn(dbModule, 'checkPostgresHealth')
      .mockResolvedValue({ status: 'error', latencyMs: 100 })
    const redisSpy = vi
      .spyOn(redisModule, 'checkRedisHealth')
      .mockResolvedValue({ status: 'ok', latencyMs: 5 })

    const controller = new HealthController()
    await controller.getStatus(req as Request, res as Response)

    expect(res.status).toHaveBeenCalledWith(503)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'degraded' }),
    )

    pgSpy.mockRestore()
    redisSpy.mockRestore()
  })

  it('returns 503 when Redis fails and PostgreSQL is ok', async () => {
    const pgSpy = vi
      .spyOn(dbModule, 'checkPostgresHealth')
      .mockResolvedValue({ status: 'ok', latencyMs: 10 })
    const redisSpy = vi
      .spyOn(redisModule, 'checkRedisHealth')
      .mockResolvedValue({ status: 'error', latencyMs: 100 })

    const controller = new HealthController()
    await controller.getStatus(req as Request, res as Response)

    expect(res.status).toHaveBeenCalledWith(503)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'degraded' }),
    )

    pgSpy.mockRestore()
    redisSpy.mockRestore()
  })

  it('returns 503 when both PostgreSQL and Redis fail', async () => {
    const pgSpy = vi
      .spyOn(dbModule, 'checkPostgresHealth')
      .mockResolvedValue({ status: 'error', latencyMs: 100 })
    const redisSpy = vi
      .spyOn(redisModule, 'checkRedisHealth')
      .mockResolvedValue({ status: 'error', latencyMs: 100 })

    const controller = new HealthController()
    await controller.getStatus(req as Request, res as Response)

    expect(res.status).toHaveBeenCalledWith(503)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'degraded' }),
    )

    pgSpy.mockRestore()
    redisSpy.mockRestore()
  })
})
