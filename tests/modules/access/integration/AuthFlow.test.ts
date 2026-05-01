import supertest from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  startIntegrationTestEnvironment,
  stopIntegrationTestEnvironment,
} from '../../../integration/support/testEnvironment.js'

describe('backend integration flows', () => {
  let request: ReturnType<typeof supertest.agent>

  beforeAll(async () => {
    const { app } = await startIntegrationTestEnvironment()

    request = supertest.agent(app)
  })

  afterAll(async () => {
    await stopIntegrationTestEnvironment()
  })

  it('reports healthy dependencies when postgres and redis are available', async () => {
    const response = await request.get('/health')

    expect(response.status).toBe(200)
    expect(response.body.status).toBe('ok')
    expect(response.body.dependencies.postgres.status).toBe('ok')
    expect(response.body.dependencies.redis.status).toBe('ok')
  })

  it('registers a user, persists authenticated cookies and exposes current session data', async () => {
    const email = `vitest-${Date.now()}@example.com`
    const password = 'super-secret-password'

    const registerResponse = await request.post('/auth/register').send({
      email,
      password,
    })

    expect(registerResponse.status).toBe(201)
    expect(registerResponse.body.user.email).toBe(email)
    expect(registerResponse.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('access_token='),
        expect.stringContaining('refresh_token='),
      ]),
    )

    const meResponse = await request.get('/auth/me')

    expect(meResponse.status).toBe(200)
    expect(meResponse.body.user.email).toBe(email)
    expect(meResponse.body.user.roles).toContain('user')

    const sessionsResponse = await request.get('/auth/sessions')

    expect(sessionsResponse.status).toBe(200)
    expect(sessionsResponse.body.sessions).toHaveLength(1)
    expect(sessionsResponse.body.sessions[0]).toMatchObject({
      isCurrent: true,
      userAgent: null,
    })
  })
})
