import cookieParser from 'cookie-parser'
import express from 'express'
import type { Container } from 'inversify'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'

import { TYPES } from '@/container/types.js'
import { ACCESS_TOKEN_COOKIE_NAME } from '@/modules/access/application/constants/auth.constants.js'
import { createAdminRouter } from '@/modules/admin/infrastructure/routes/admin.routes.js'
import { AppError } from '@/shared/errors/AppError.js'

vi.mock('@/shared/middlewares/authenticate.js', () => ({
  createAuthenticate:
    () =>
    (
      request: express.Request,
      _response: express.Response,
      next: express.NextFunction,
    ) => {
      const isAdmin = request.get('x-role') === 'admin'
      request.user = {
        userId: '11111111-1111-4111-8111-111111111111',
        role: isAdmin ? 'admin' : 'user',
        roles: [isAdmin ? 'admin' : 'user'],
        authzVersion: 1,
        jti: '22222222-2222-4222-8222-222222222222',
        sessionKey: null,
      }
      next()
    },
}))

const createContainer = (bindings: Map<symbol, unknown>): Container =>
  ({
    get: (identifier: symbol) => bindings.get(identifier),
  }) as unknown as Container

describe('AdminFlow', () => {
  it('allows admin and blocks non-admin with 403', async () => {
    const listRolesUseCase = {
      execute: vi.fn(() => Promise.resolve({ roles: [] })),
    }
    const controller = {
      listRoles: vi.fn(async (_request, response) => {
        const payload = await listRolesUseCase.execute()
        response.status(200).json(payload)
      }),
      listUsers: vi.fn(),
      getUserProfile: vi.fn(),
      updateUserStatus: vi.fn(),
      softDeleteUser: vi.fn(),
      listUserRoles: vi.fn(),
      assignUserRole: vi.fn(),
      revokeUserRole: vi.fn(),
    }

    const app = express()
    app.use(cookieParser('test-secret'))
    app.use(
      '/admin',
      createAdminRouter(
        createContainer(
          new Map([
            [TYPES.AdminController, controller],
            [TYPES.ITokenService, {}],
            [TYPES.ISessionStore, {}],
            [TYPES.IUserSessionRepository, {}],
          ]),
        ),
      ),
    )
    app.use((error: unknown, _request, response, _next) => {
      if (error instanceof AppError) {
        response.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
          },
        })
        return
      }
      response.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'unexpected',
        },
      })
    })

    await request(app).get('/admin/roles').set('x-role', 'user').expect(403)
    await request(app).get('/admin/roles').set('x-role', 'admin').expect(200)

    expect(listRolesUseCase.execute).toHaveBeenCalledOnce()
  })

  it('updates status and clears auth cookies when role/status mutation says so', async () => {
    const updateUserStatusUseCase = {
      execute: vi.fn(() =>
        Promise.resolve({
          clearAuthCookies: true,
        }),
      ),
    }
    const controller = {
      listRoles: vi.fn(),
      listUsers: vi.fn(),
      getUserProfile: vi.fn(),
      listUserRoles: vi.fn(),
      assignUserRole: vi.fn(),
      revokeUserRole: vi.fn(),
      softDeleteUser: vi.fn(),
      updateUserStatus: vi.fn(async (request, response) => {
        await updateUserStatusUseCase.execute({
          actorUserId: request.user?.userId,
          targetUserId: request.params.userId,
          status: request.body.status,
          accessToken: null,
          requestId: null,
          userAgent: null,
          ipAddress: null,
        })
        response.clearCookie(ACCESS_TOKEN_COOKIE_NAME)
        response.clearCookie('refresh_token')
        response.status(200).json({
          message: 'User status updated successfully',
        })
      }),
    }

    const app = express()
    app.use(express.json())
    app.use(cookieParser('test-secret'))
    app.use(
      '/admin',
      createAdminRouter(
        createContainer(
          new Map([
            [TYPES.AdminController, controller],
            [TYPES.ITokenService, {}],
            [TYPES.ISessionStore, {}],
            [TYPES.IUserSessionRepository, {}],
          ]),
        ),
      ),
    )
    app.use((error: unknown, _request, response, _next) => {
      if (error instanceof AppError) {
        response.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
          },
        })
        return
      }
      response.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'unexpected',
        },
      })
    })

    const response = await request(app)
      .patch('/admin/users/33333333-3333-4333-8333-333333333333/status')
      .set('x-role', 'admin')
      .send({
        status: 'disabled',
      })
      .expect(200)

    expect(updateUserStatusUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        targetUserId: '33333333-3333-4333-8333-333333333333',
        status: 'disabled',
      }),
    )
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`${ACCESS_TOKEN_COOKIE_NAME}=`),
        expect.stringContaining('refresh_token='),
      ]),
    )
  })
})
