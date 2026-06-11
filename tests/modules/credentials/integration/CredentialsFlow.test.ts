import cookieParser from 'cookie-parser'
import express from 'express'
import type { Container } from 'inversify'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'

import { TYPES } from '@/container/types.js'
import {
  ACCESS_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
} from '@/modules/access/application/constants/auth.constants.js'
import { createCredentialsRouter } from '@/modules/credentials/infrastructure/routes/credentials.routes.js'
import { CredentialsController } from '@/modules/credentials/infrastructure/controllers/CredentialsController.js'
import type { ForgotPasswordUseCase } from '@/modules/credentials/application/use-cases/ForgotPasswordUseCase.js'
import type { ResetPasswordUseCase } from '@/modules/credentials/application/use-cases/ResetPasswordUseCase.js'
import type { VerifyEmailUseCase } from '@/modules/credentials/application/use-cases/VerifyEmailUseCase.js'
import type { ResendVerificationUseCase } from '@/modules/credentials/application/use-cases/ResendVerificationUseCase.js'
import type { ChangePasswordUseCase } from '@/modules/credentials/application/use-cases/ChangePasswordUseCase.js'
import type { ChangeEmailUseCase } from '@/modules/credentials/application/use-cases/ChangeEmailUseCase.js'
import { AppError } from '@/shared/errors/AppError.js'
import { UnauthorizedError } from '@/shared/errors/HttpErrors.js'

// Mock del middleware authenticate.js para simular un usuario logueado en las peticiones que requieren x-role: user
vi.mock('@/shared/middlewares/authenticate.js', () => ({
  createAuthenticate:
    () =>
    (
      request: express.Request,
      _response: express.Response,
      next: express.NextFunction,
    ) => {
      // Inyección mock del payload de sesión de usuario autenticado
      request.user = {
        userId: '11111111-1111-4111-8111-111111111111',
        role: 'user',
        roles: ['user'],
        authzVersion: 1,
        jti: '22222222-2222-4222-8222-222222222222',
        sessionKey: 'mock-session-key',
      }
      next()
    },
}))

// Creador mock rápido de contenedores Inversify para la inyección de dependencias de la ruta
const createContainer = (bindings: Map<symbol, unknown>): Container =>
  ({
    get: (identifier: symbol) => bindings.get(identifier),
  }) as unknown as Container

describe('CredentialsFlow Integration - Pruebas de Integración (Supertest)', () => {
  // Instanciación de mocks de los casos de uso
  const mockForgotPasswordUseCase = {
    execute: vi.fn(),
  }
  const mockResetPasswordUseCase = {
    execute: vi.fn(),
  }
  const mockVerifyEmailUseCase = {
    execute: vi.fn(),
  }
  const mockResendVerificationUseCase = {
    execute: vi.fn(),
  }
  const mockChangePasswordUseCase = {
    execute: vi.fn(),
  }
  const mockChangeEmailUseCase = {
    execute: vi.fn(),
  }

  // Creación del controlador inyectando los mocks creados
  const controller = new CredentialsController(
    mockForgotPasswordUseCase as unknown as ForgotPasswordUseCase,
    mockResetPasswordUseCase as unknown as ResetPasswordUseCase,
    mockVerifyEmailUseCase as unknown as VerifyEmailUseCase,
    mockResendVerificationUseCase as unknown as ResendVerificationUseCase,
    mockChangePasswordUseCase as unknown as ChangePasswordUseCase,
    mockChangeEmailUseCase as unknown as ChangeEmailUseCase,
  )

  // Configuración del servidor mock Express y las rutas para los endpoints de credentials
  const app = express()
  app.use(express.json())
  app.use(cookieParser('test-secret'))
  app.use(
    '/auth',
    createCredentialsRouter(
      createContainer(
        new Map<symbol, unknown>([
          [TYPES.CredentialsController, controller],
          [TYPES.ITokenService, {}],
          [TYPES.ISessionStore, {}],
          [TYPES.IUserSessionRepository, {}],
        ]),
      ),
    ),
  )

  // Middleware de manejo de errores idéntico al del servidor real de backend
  app.use(
    (
      error: unknown,
      _request: express.Request,
      response: express.Response,
      _next: express.NextFunction,
    ) => {
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
    },
  )

  it('1. POST /auth/forgot-password returns 200 and previewToken in test', async () => {
    // Caso 1: Solicitar recuperación de contraseña responde 200 y retorna el previewToken en ambientes de prueba/dev
    mockForgotPasswordUseCase.execute.mockResolvedValue({
      previewToken: '55555555-5555-4555-8555-555555555555.secret',
    })

    const response = await request(app)
      .post('/auth/forgot-password')
      .send({ email: 'user@example.com' })
      .expect(200)

    expect(response.body).toHaveProperty(
      'previewToken',
      '55555555-5555-4555-8555-555555555555.secret',
    )
    expect(mockForgotPasswordUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'user@example.com',
      }),
    )
  })

  it('2. POST /auth/reset-password with valid token returns 200', async () => {
    // Caso 2: Restablecer contraseña con un token temporal válido retorna código HTTP 200 OK
    mockResetPasswordUseCase.execute.mockResolvedValue(undefined)

    await request(app)
      .post('/auth/reset-password')
      .send({
        token: '11111111-1111-4111-8111-111111111111.secret',
        newPassword: 'new-valid-password',
      })
      .expect(200)

    expect(mockResetPasswordUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        token: '11111111-1111-4111-8111-111111111111.secret',
        newPassword: 'new-valid-password',
      }),
    )
  })

  it('3. POST /auth/reset-password with invalid token returns 401', async () => {
    // Caso 3: Si el restablecimiento falla por token inválido o expirado, retorna 401 Unauthorized
    mockResetPasswordUseCase.execute.mockRejectedValue(
      new UnauthorizedError('Invalid or expired reset token'),
    )

    const response = await request(app)
      .post('/auth/reset-password')
      .send({
        token: '11111111-1111-4111-8111-111111111111.secret',
        newPassword: 'new-valid-password',
      })
      .expect(401)

    expect(response.body.error.code).toBe('UNAUTHORIZED')
  })

  it('4. POST /auth/verify-email with valid token returns 200', async () => {
    // Caso 4: La validación correcta de correo retorna 200 OK
    mockVerifyEmailUseCase.execute.mockResolvedValue(undefined)

    await request(app)
      .post('/auth/verify-email')
      .send({
        token: '11111111-1111-4111-8111-111111111111.secret',
      })
      .expect(200)

    expect(mockVerifyEmailUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        token: '11111111-1111-4111-8111-111111111111.secret',
      }),
    )
  })

  it('5. POST /auth/verify-email with invalid token returns 401', async () => {
    // Caso 5: La validación incorrecta o con token fallido responde con código 401 Unauthorized
    mockVerifyEmailUseCase.execute.mockRejectedValue(
      new UnauthorizedError('Invalid or expired verification token'),
    )

    const response = await request(app)
      .post('/auth/verify-email')
      .send({
        token: '11111111-1111-4111-8111-111111111111.secret',
      })
      .expect(401)

    expect(response.body.error.code).toBe('UNAUTHORIZED')
  })

  it('6. POST /auth/resend-verification returns 200 without auth', async () => {
    // Caso 6: El reenvío de email de verificación no requiere autorización obligatoria y responde de manera neutral
    mockResendVerificationUseCase.execute.mockResolvedValue({
      previewToken: 'new-token.secret',
    })

    const response = await request(app)
      .post('/auth/resend-verification')
      .send({ email: 'user@example.com' })
      .expect(200)

    expect(response.body).toHaveProperty('previewToken', 'new-token.secret')
  })

  it('7. POST /auth/change-password returns 200 and clears auth cookies', async () => {
    // Caso 7: Cambio de password exitoso responde 200 y limpia cookies de sesión
    mockChangePasswordUseCase.execute.mockResolvedValue(undefined)

    const response = await request(app)
      .post('/auth/change-password')
      .set('x-role', 'user')
      .send({
        currentPassword: 'old-valid-password',
        newPassword: 'new-valid-password',
      })
      .expect(200)

    expect(mockChangePasswordUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: '11111111-1111-4111-8111-111111111111',
        currentPassword: 'old-valid-password',
        newPassword: 'new-valid-password',
      }),
    )

    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`${ACCESS_TOKEN_COOKIE_NAME}=`),
        expect.stringContaining(`${REFRESH_TOKEN_COOKIE_NAME}=`),
      ]),
    )
  })

  it('8. PATCH /auth/me/email returns 200 and clears auth cookies', async () => {
    // Caso 8: Cambiar el email de usuario responde 200, limpia las cookies para forzar re-login/re-verificación y entrega el token de previsualización
    mockChangeEmailUseCase.execute.mockResolvedValue({
      previewToken: 'new-verification-token.secret',
    })

    const response = await request(app)
      .patch('/auth/me/email')
      .set('x-role', 'user')
      .send({
        email: 'newemail@example.com',
      })
      .expect(200)

    expect(mockChangeEmailUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: '11111111-1111-4111-8111-111111111111',
        email: 'newemail@example.com',
      }),
    )

    expect(response.body).toHaveProperty(
      'previewToken',
      'new-verification-token.secret',
    )

    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`${ACCESS_TOKEN_COOKIE_NAME}=`),
        expect.stringContaining(`${REFRESH_TOKEN_COOKIE_NAME}=`),
      ]),
    )
  })
})
