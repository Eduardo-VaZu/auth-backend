import { jest } from '@jest/globals'
import type { Request, Response } from 'express'

const checkPostgresHealthMock = jest.fn()
const checkRedisHealthMock = jest.fn()

jest.unstable_mockModule('@/infrastructure/db/db', () => ({
  checkPostgresHealth: checkPostgresHealthMock,
}))

jest.unstable_mockModule('@/infrastructure/redis', () => ({
  checkRedisHealth: checkRedisHealthMock,
}))

const { HealthController } = await import('@/modules/health/HealthController')

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
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
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

    const payload = (response.json as jest.Mock).mock.calls[0][0] as JsonResponse

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

    const payload = (response.json as jest.Mock).mock.calls[0][0] as JsonResponse

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
