import type { Request, Response } from 'express'
import { describe, expect, it, vi } from 'vitest'

const checkPostgresHealthMock = vi.fn()
const checkRedisHealthMock = vi.fn()

vi.mock('@/infrastructure/db/db.js', () => ({
  checkPostgresHealth: checkPostgresHealthMock,
}))

vi.mock('@/infrastructure/redis.js', () => ({
  checkRedisHealth: checkRedisHealthMock,
}))

const { HealthController } = await import('@/modules/health/HealthController.js')

type JsonResponse = {
  status: string
  timestamp: string
  uptime: number
  dependencies: {
    postgres: {
      status: string
      latencyMs?: number
      error?: string
    }
    redis: {
      status: string
      latencyMs?: number
      error?: string
    }
  }
}

const createResponseMock = (): Response => {
  const response = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  }

  return response as unknown as Response
}

describe('HealthController', () => {
  it('returns 200 and ok status when postgres and redis are healthy', async () => {
    checkPostgresHealthMock.mockResolvedValue({
      status: 'ok',
      latencyMs: 3,
    })
    checkRedisHealthMock.mockResolvedValue({
      status: 'ok',
      latencyMs: 1,
    })

    const controller = new HealthController()
    const response = createResponseMock()

    await controller.getStatus({} as Request, response)

    expect(response.status).toHaveBeenCalledWith(200)
    expect(response.json).toHaveBeenCalledTimes(1)

    const firstJsonCall = vi.mocked(response.json).mock.calls[0]
    expect(firstJsonCall).toBeDefined()
    const payload = firstJsonCall![0] as JsonResponse

    expect(payload.status).toBe('ok')
    expect(payload.timestamp).toEqual(expect.any(String))
    expect(payload.uptime).toEqual(expect.any(Number))
    expect(payload.dependencies).toEqual({
      postgres: {
        status: 'ok',
        latencyMs: 3,
      },
      redis: {
        status: 'ok',
        latencyMs: 1,
      },
    })
  })

  it('returns 503 and degraded status when a dependency is unhealthy', async () => {
    checkPostgresHealthMock.mockResolvedValue({
      status: 'error',
      error: 'database unavailable',
    })
    checkRedisHealthMock.mockResolvedValue({
      status: 'ok',
      latencyMs: 2,
    })

    const controller = new HealthController()
    const response = createResponseMock()

    await controller.getStatus({} as Request, response)

    expect(response.status).toHaveBeenCalledWith(503)
    expect(response.json).toHaveBeenCalledTimes(1)

    const firstJsonCall = vi.mocked(response.json).mock.calls[0]
    expect(firstJsonCall).toBeDefined()
    const payload = firstJsonCall![0] as JsonResponse

    expect(payload.status).toBe('degraded')
    expect(payload.dependencies).toEqual({
      postgres: {
        status: 'error',
        error: 'database unavailable',
      },
      redis: {
        status: 'ok',
        latencyMs: 2,
      },
    })
  })
})
