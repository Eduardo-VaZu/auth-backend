import { describe, expect, it, beforeAll } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
// @ts-expect-error cookie-signature lacks typings in devDependencies
import { sign } from 'cookie-signature'

import { createApp } from '@/app.js'
import { container } from '@/container/inversify.config.js'
import { TYPES } from '@/container/types.js'
import type { AppRedisClient } from '@/infrastructure/redis.js'

const cookieSecret =
  process.env.COOKIE_SECRET ?? 'cookie-secret-cookie-secret-cookie'

const buildTamperedSignedCookieHeader = (name: string, value: string) => {
  const signedValue = `s:${sign(value, cookieSecret)}`
  const replacementChar = signedValue.endsWith('a') ? 'b' : 'a'
  const tamperedValue = `${signedValue.slice(0, -1)}${replacementChar}`

  return `${name}=${encodeURIComponent(tamperedValue)}`
}

describe('OWASP - Tampered refresh cookie rejection', () => {
  let app: Express

  beforeAll(async () => {
    const binding = await container.rebind<AppRedisClient>(TYPES.RedisClient)
    binding.toConstantValue({
      sendCommand: async (command: string[]) => {
        if (command[0] === 'SCRIPT') return 'mock-sha-hash'
        return [1, 60000]
      },
    } as unknown as AppRedisClient)

    app = createApp(container)
  })

  it('POST /auth/refresh rejects tampered signed cookies with 401', async () => {
    const tamperedCookie = buildTamperedSignedCookieHeader(
      'refresh_token',
      'tampered-refresh-token',
    )

    const response = await request(app)
      .post('/auth/refresh')
      .set('Cookie', [tamperedCookie])

    expect(response.status).toBe(401)
    expect(response.body.error.code).toBe('UNAUTHORIZED')
    expect(response.body.error.message).toBe('Missing refresh token')
    expect(response.headers['set-cookie']).toBeUndefined()
  })
})
