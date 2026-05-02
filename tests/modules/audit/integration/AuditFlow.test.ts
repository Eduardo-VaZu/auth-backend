import cookieParser from 'cookie-parser'
import express from 'express'
import type { Container } from 'inversify'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'

import { TYPES } from '@/container/types.js'
import { createAuditRouter } from '@/modules/audit/infrastructure/routes/audit.routes.js'
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

describe('AuditFlow', () => {
  it('requires admin and returns filtered paginated audit logs', async () => {
    const listLogs = vi.fn(async (request, response) => {
      response.status(200).json({
        logs: [
          {
            id: '33333333-3333-4333-8333-333333333333',
            userId: request.query.userId,
            actorUserId: request.query.actorUserId,
            sessionId: null,
            roleId: null,
            eventType: request.query.eventType,
            eventStatus: request.query.eventStatus,
            ipAddress: null,
            userAgent: null,
            requestId: request.query.requestId,
            metadata: {},
            createdAt: '2026-05-02T00:00:00.000Z',
          },
        ],
        pagination: {
          page: 2,
          limit: 5,
          total: 6,
          totalPages: 2,
        },
      })
    })

    const app = express()
    app.use(cookieParser('test-secret'))
    app.use(
      '/admin',
      createAuditRouter(
        createContainer(
          new Map([
            [
              TYPES.AuditController,
              {
                listLogs,
              },
            ],
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

    await request(app)
      .get('/admin/audit-logs')
      .set('x-role', 'user')
      .expect(403)

    const response = await request(app)
      .get('/admin/audit-logs')
      .set('x-role', 'admin')
      .query({
        page: 2,
        limit: 5,
        userId: '44444444-4444-4444-8444-444444444444',
        actorUserId: '55555555-5555-4555-8555-555555555555',
        requestId: '66666666-6666-4666-8666-666666666666',
        eventType: 'user_status_updated',
        eventStatus: 'success',
      })
      .expect(200)

    expect(listLogs).toHaveBeenCalledOnce()
    expect(response.body.pagination).toEqual({
      page: 2,
      limit: 5,
      total: 6,
      totalPages: 2,
    })
    expect(response.body.logs[0]).toEqual(
      expect.objectContaining({
        userId: '44444444-4444-4444-8444-444444444444',
        actorUserId: '55555555-5555-4555-8555-555555555555',
        eventType: 'user_status_updated',
        eventStatus: 'success',
      }),
    )
  })
})
