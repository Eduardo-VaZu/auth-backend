import type { Request, Response } from 'express'

import { injectable } from 'inversify'

import { checkPostgresHealth } from '../../infrastructure/db/db.js'
import { checkRedisHealth } from '../../infrastructure/redis.js'

@injectable()
export class HealthController {
  public async getStatus(_request: Request, response: Response): Promise<void> {
    const [postgres, redis] = await Promise.all([
      checkPostgresHealth(),
      checkRedisHealth(),
    ])

    const status =
      postgres.status === 'ok' && redis.status === 'ok' ? 'ok' : 'degraded'

    response.status(status === 'ok' ? 200 : 503).json({
      status,
      timestamp: new Date().toISOString(),
      uptime: Number(process.uptime().toFixed(2)),
      dependencies: {
        postgres,
        redis,
      },
    })
  }
}
