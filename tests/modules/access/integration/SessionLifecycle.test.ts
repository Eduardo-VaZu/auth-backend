import express from 'express'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
// @ts-expect-error cookie-signature lacks typings in devDependencies
import { sign } from 'cookie-signature'
import type { Container } from 'inversify'

import { TYPES } from '@/container/types.js'
import { createAuthRouter } from '@/modules/access/infrastructure/routes/auth.routes.js'
import { AccessController } from '@/modules/access/infrastructure/controllers/AccessController.js'
import { AppError } from '@/shared/errors/AppError.js'
import { UnauthorizedError } from '@/shared/errors/HttpErrors.js'
import type { LoginUseCase } from '@/modules/access/application/use-cases/LoginUseCase.js'
import type { ListSessionsUseCase } from '@/modules/access/application/use-cases/ListSessionsUseCase.js'
import type { RefreshTokenUseCase } from '@/modules/access/application/use-cases/RefreshTokenUseCase.js'
import type { RevokeSessionUseCase } from '@/modules/access/application/use-cases/RevokeSessionUseCase.js'
import type { LogoutUseCase } from '@/modules/access/application/use-cases/LogoutUseCase.js'
import type { LogoutAllUseCase } from '@/modules/access/application/use-cases/LogoutAllUseCase.js'

/**
 * Mock del middleware de autenticación global.
 * Pre-autentica las llamadas inyectando un usuario de prueba en `request.user`
 * para evitar depender de dependencias complejas de tokens en la infraestructura.
 */
vi.mock('@/shared/middlewares/authenticate.js', () => ({
  createAuthenticate:
    () =>
    (
      request: express.Request,
      _response: express.Response,
      next: express.NextFunction,
    ) => {
      request.user = {
        userId: '11111111-1111-4111-8111-111111111111',
        role: 'user',
        roles: ['user'],
        authzVersion: 1,
        jti: '22222222-2222-4222-8222-222222222222',
        sessionKey: 'some-session-key',
      }
      next()
    },
}))

/**
 * Función helper para simular el contenedor IOC de Inversify.
 */
const createContainer = (bindings: Map<symbol, unknown>): Container =>
  ({
    get: (identifier: symbol) => bindings.get(identifier),
  }) as unknown as Container

/**
 * Pruebas de integración para el ciclo de vida de sesiones y flujos HTTP de Logout.
 * Realiza peticiones HTTP simuladas a los endpoints reales con Supertest,
 * inyectando mocks de los casos de uso para aislar la base de datos y Redis.
 */
describe('SessionLifecycle Integration Tests', () => {
  const cookieSecret = 'test-secret'
  const mockUserId = '11111111-1111-4111-8111-111111111111'
  const mockSessionKey = 'some-session-key'

  /**
   * Helper para generar la cabecera Cookie con la firma esperada por cookie-parser.
   */
  const getSignedCookieHeader = (name: string, value: string) => {
    const signed = `s:${sign(value, cookieSecret)}`
    return `${name}=${encodeURIComponent(signed)}`
  }

  /**
   * Inicializa la aplicación Express de prueba con la configuración de rutas y
   * middleware de control de errores.
   */
  const setupApp = (controller: AccessController) => {
    const app = express()
    app.use(express.json())
    app.use(cookieParser(cookieSecret))
    app.use(
      '/auth',
      createAuthRouter(
        createContainer(
          new Map<symbol, unknown>([
            [TYPES.AccessController, controller],
            [TYPES.ITokenService, {}],
            [TYPES.ISessionStore, {}],
            [TYPES.IUserSessionRepository, {}],
          ]),
        ),
      ),
    )
    // Middleware global de manejo de excepciones HTTP
    app.use(
      (
        error: unknown,
        _req: express.Request,
        res: express.Response,
        _next: express.NextFunction,
      ) => {
        if (error instanceof AppError) {
          res.status(error.statusCode).json({
            error: {
              code: error.code,
              message: error.message,
            },
          })
          return
        }
        res.status(500).json({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'unexpected',
          },
        })
      },
    )
    return app
  }

  it('GET /auth/sessions -> returns 200 with list of active sessions', async () => {
    const listSessionsUseCase = {
      execute: vi.fn(() =>
        Promise.resolve({
          sessions: [
            {
              id: 'sess-123',
              deviceName: 'Device',
              userAgent: 'Mozilla',
              ipAddress: '127.0.0.1',
              lastActivityAt: new Date().toISOString(),
              expiresAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              isCurrent: true,
            },
          ],
        }),
      ),
    }

    const controller = new AccessController(
      {} as unknown as LoginUseCase,
      listSessionsUseCase as unknown as ListSessionsUseCase,
      {} as unknown as RefreshTokenUseCase,
      {} as unknown as RevokeSessionUseCase,
      {} as unknown as LogoutUseCase,
      {} as unknown as LogoutAllUseCase,
    )

    const app = setupApp(controller)
    const accessTokenCookie = getSignedCookieHeader(
      'access_token',
      'valid-access-token',
    )

    const response = await request(app)
      .get('/auth/sessions')
      .set('Cookie', [accessTokenCookie])
      .expect(200)

    // Valida que el controlador delegue correctamente los IDs del usuario autenticado
    expect(listSessionsUseCase.execute).toHaveBeenCalledWith(
      mockUserId,
      mockSessionKey,
    )
    expect(response.body.sessions).toHaveLength(1)
    expect(response.body.sessions[0].id).toBe('sess-123')
  })

  it('DELETE /auth/sessions/:sessionId -> returns 200 and revokes the session', async () => {
    const revokeSessionUseCase = {
      execute: vi.fn(() => Promise.resolve({ isCurrentSession: false })),
    }

    const controller = new AccessController(
      {} as unknown as LoginUseCase,
      {} as unknown as ListSessionsUseCase,
      {} as unknown as RefreshTokenUseCase,
      revokeSessionUseCase as unknown as RevokeSessionUseCase,
      {} as unknown as LogoutUseCase,
      {} as unknown as LogoutAllUseCase,
    )

    const app = setupApp(controller)
    const accessTokenCookie = getSignedCookieHeader(
      'access_token',
      'valid-access-token',
    )

    await request(app)
      .delete('/auth/sessions/sess-123')
      .set('Cookie', [accessTokenCookie])
      .expect(200)

    // Verifica que el caso de uso es invocado con el ID de sesión enviado en la ruta
    expect(revokeSessionUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'sess-123',
        userId: mockUserId,
        currentSessionKey: mockSessionKey,
      }),
    )
  })

  it('DELETE /auth/sessions/:sessionId -> clears cookies if it was the current session', async () => {
    // Si la sesión eliminada resulta ser la del cliente actual
    const revokeSessionUseCase = {
      execute: vi.fn(() => Promise.resolve({ isCurrentSession: true })),
    }

    const controller = new AccessController(
      {} as unknown as LoginUseCase,
      {} as unknown as ListSessionsUseCase,
      {} as unknown as RefreshTokenUseCase,
      revokeSessionUseCase as unknown as RevokeSessionUseCase,
      {} as unknown as LogoutUseCase,
      {} as unknown as LogoutAllUseCase,
    )

    const app = setupApp(controller)
    const accessTokenCookie = getSignedCookieHeader(
      'access_token',
      'valid-access-token',
    )

    const response = await request(app)
      .delete('/auth/sessions/sess-123')
      .set('Cookie', [accessTokenCookie])
      .expect(200)

    // El servidor debe responder instruyendo la limpieza inmediata de cookies en la cabecera Set-Cookie
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('access_token='),
        expect.stringContaining('refresh_token='),
      ]),
    )
  })

  it('POST /auth/logout -> works, clears cookies, and remains idempotent', async () => {
    const logoutUseCase = {
      execute: vi.fn(() => Promise.resolve()),
    }

    const controller = new AccessController(
      {} as unknown as LoginUseCase,
      {} as unknown as ListSessionsUseCase,
      {} as unknown as RefreshTokenUseCase,
      {} as unknown as RevokeSessionUseCase,
      logoutUseCase as unknown as LogoutUseCase,
      {} as unknown as LogoutAllUseCase,
    )

    const app = setupApp(controller)
    const accessTokenCookie = getSignedCookieHeader(
      'access_token',
      'valid-access-token',
    )
    const refreshTokenCookie = getSignedCookieHeader(
      'refresh_token',
      'valid-refresh-token',
    )

    // Llamada 1: Con cookies. Debe llamar al use case y limpiar las cookies
    const response1 = await request(app)
      .post('/auth/logout')
      .set('Cookie', [accessTokenCookie, refreshTokenCookie])
      .expect(200)

    expect(logoutUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: 'valid-access-token',
        refreshToken: 'valid-refresh-token',
      }),
    )
    expect(response1.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('access_token='),
        expect.stringContaining('refresh_token='),
      ]),
    )

    // Llamada 2: Sin cookies (idempotencia). Debe responder 200 sin arrojar error
    await request(app).post('/auth/logout').expect(200)
  })

  it('POST /auth/logout-all -> returns 200 and clears cookies', async () => {
    const logoutAllUseCase = {
      execute: vi.fn(() => Promise.resolve()),
    }

    const controller = new AccessController(
      {} as unknown as LoginUseCase,
      {} as unknown as ListSessionsUseCase,
      {} as unknown as RefreshTokenUseCase,
      {} as unknown as RevokeSessionUseCase,
      {} as unknown as LogoutUseCase,
      logoutAllUseCase as unknown as LogoutAllUseCase,
    )

    const app = setupApp(controller)
    const accessTokenCookie = getSignedCookieHeader(
      'access_token',
      'valid-access-token',
    )

    const response = await request(app)
      .post('/auth/logout-all')
      .set('Cookie', [accessTokenCookie])
      .expect(200)

    // Verifica revocación global
    expect(logoutAllUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: 'valid-access-token',
        userId: mockUserId,
        sessionKey: mockSessionKey,
      }),
    )
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('access_token='),
        expect.stringContaining('refresh_token='),
      ]),
    )
  })

  it('POST /auth/refresh -> returns 401 when the session is revoked', async () => {
    // Si la sesión fue revocada, renovar el token debe fallar
    const refreshTokenUseCase = {
      execute: vi.fn(() => {
        throw new UnauthorizedError('Session revoked')
      }),
    }

    const controller = new AccessController(
      {} as unknown as LoginUseCase,
      {} as unknown as ListSessionsUseCase,
      refreshTokenUseCase as unknown as RefreshTokenUseCase,
      {} as unknown as RevokeSessionUseCase,
      {} as unknown as LogoutUseCase,
      {} as unknown as LogoutAllUseCase,
    )

    const app = setupApp(controller)
    const refreshTokenCookie = getSignedCookieHeader(
      'refresh_token',
      'revoked-refresh-token',
    )

    const response = await request(app)
      .post('/auth/refresh')
      .set('Cookie', [refreshTokenCookie])
      .expect(401)

    // Retorna error 401 con el mensaje esperado
    expect(response.body.error.message).toBe('Session revoked')
  })
})
