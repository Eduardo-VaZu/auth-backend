import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Logger } from 'pino'
import { AuthEmailService } from '@/modules/credentials/infrastructure/services/AuthEmailService.js'
import { env } from '@/config/env.js'
import { InternalError } from '@/shared/errors/HttpErrors.js'

const { mockEnv } = vi.hoisted(() => ({
  mockEnv: {
    EMAIL_DELIVERY_MODE: 'preview',
    BREVO_API_KEY: 'test-api-key',
    BREVO_SENDER_EMAIL: 'sender@example.com',
    BREVO_SENDER_NAME: 'Auth Backend',
  },
}))

vi.mock('@/config/env.js', () => ({
  env: mockEnv,
}))

describe('AuthEmailService - Pruebas Unitarias', () => {
  let emailService: AuthEmailService
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
  } as unknown as Logger

  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', fetchMock)
    emailService = new AuthEmailService(mockLogger)
  })

  it('returns previewToken in preview mode', async () => {
    // Caso 1: En modo 'preview', debe retornar el token de previsualización sin invocar fetch
    mockEnv.EMAIL_DELIVERY_MODE = 'preview'

    const result = await emailService.sendPasswordResetEmail({
      email: 'user@example.com',
      token: 'uuid.secret',
      expiresAt: new Date('2026-06-11T00:00:00.000Z'),
      requestId: 'req-123',
    })

    expect(result).toEqual({ previewToken: 'uuid.secret' })
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: 'user@example.com',
        previewToken: 'uuid.secret',
      }),
      'Auth email generated in preview mode',
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends email via Brevo API in production mode', async () => {
    // Caso 2: En modo producción ('brevo'), debe enviar los datos del correo a la API de Brevo
    mockEnv.EMAIL_DELIVERY_MODE = 'brevo'
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
    })

    const result = await emailService.sendPasswordResetEmail({
      email: 'user@example.com',
      token: 'uuid.secret',
      expiresAt: new Date('2026-06-11T00:00:00.000Z'),
      requestId: 'req-123',
    })

    expect(result).toEqual({ previewToken: null })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.brevo.com/v3/smtp/email',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'api-key': 'test-api-key',
          'content-type': 'application/json',
        },
      }),
    )

    const callBody = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(callBody).toEqual({
      sender: {
        email: 'sender@example.com',
        name: 'Auth Backend',
      },
      to: [
        {
          email: 'user@example.com',
        },
      ],
      subject: 'Password reset instructions',
      textContent: expect.stringContaining('uuid.secret'),
    })
  })

  it('throws InternalError on Brevo API failure', async () => {
    // Caso 3: Si la API de Brevo responde con un código de error (>=400), debe lanzar un InternalError
    mockEnv.EMAIL_DELIVERY_MODE = 'brevo'
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
    })

    await expect(
      emailService.sendPasswordResetEmail({
        email: 'user@example.com',
        token: 'uuid.secret',
        expiresAt: new Date('2026-06-11T00:00:00.000Z'),
        requestId: 'req-123',
      }),
    ).rejects.toThrow(InternalError)

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: 'user@example.com',
        statusCode: 500,
        responseBody: 'Internal Server Error',
      }),
      'Brevo email dispatch failed',
    )
  })

  it('returns null previewToken in production mode', async () => {
    // Caso 4: En producción, no debe retornar ningún previewToken (debe ser null) para evitar fuga de tokens
    mockEnv.EMAIL_DELIVERY_MODE = 'brevo'
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
    })

    const result = await emailService.sendVerificationEmail({
      email: 'user@example.com',
      token: 'uuid.secret',
      expiresAt: new Date('2026-06-11T00:00:00.000Z'),
      requestId: 'req-123',
      reason: 'email_change',
    })

    expect(result).toEqual({ previewToken: null })
  })
})
