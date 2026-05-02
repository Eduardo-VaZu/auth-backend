import express from 'express'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import type { Container } from 'inversify'

import { TYPES } from '@/container/types.js'
import { createAuthRouter } from '@/modules/access/infrastructure/routes/auth.routes.js'
import { createCredentialsRouter } from '@/modules/credentials/infrastructure/routes/credentials.routes.js'

const createContainer = (bindings: Map<symbol, unknown>): Container => {
  return {
    get: (identifier: symbol) => bindings.get(identifier),
  } as unknown as Container
}

describe('Public auth routes', () => {
  it('allows logout without authenticated middleware state', async () => {
    const logout = vi.fn(async (_request, response) => {
      response.status(200).json({
        message: 'Logged out successfully',
      })
    })

    const app = express()
    app.use(express.json())
    app.use(
      '/auth',
      createAuthRouter(
        createContainer(
          new Map([
            [
              TYPES.AccessController,
              {
                login: vi.fn(),
                refresh: vi.fn(),
                sessions: vi.fn(),
                revokeSession: vi.fn(),
                logout,
                logoutAll: vi.fn(),
              },
            ],
            [TYPES.ITokenService, {}],
            [TYPES.ISessionStore, {}],
            [TYPES.IUserSessionRepository, {}],
          ]),
        ),
      ),
    )

    await request(app).post('/auth/logout').expect(200)

    expect(logout).toHaveBeenCalledOnce()
  })

  it('allows resend verification without authentication', async () => {
    const resendVerification = vi.fn(async (_request, response) => {
      response.status(200).json({
        message: 'Verification instructions generated',
      })
    })

    const app = express()
    app.use(express.json())
    app.use(
      '/auth',
      createCredentialsRouter(
        createContainer(
          new Map([
            [
              TYPES.CredentialsController,
              {
                forgotPassword: vi.fn(),
                resetPassword: vi.fn(),
                verifyEmail: vi.fn(),
                resendVerification,
                changePassword: vi.fn(),
                changeEmail: vi.fn(),
              },
            ],
            [TYPES.ITokenService, {}],
            [TYPES.ISessionStore, {}],
            [TYPES.IUserSessionRepository, {}],
          ]),
        ),
      ),
    )

    await request(app)
      .post('/auth/resend-verification')
      .send({ email: 'user@example.com' })
      .expect(200)

    expect(resendVerification).toHaveBeenCalledOnce()
  })
})
