/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import argon2 from 'argon2'
import { LoginUseCase } from '@/modules/access/application/use-cases/LoginUseCase.js'
import { User } from '@/modules/identity/domain/entities/User.js'
import { UnauthorizedError } from '@/shared/errors/HttpErrors.js'

describe('LoginUseCase', () => {
  let passwordHash: string

  let mockUserRepository: any
  let mockCredentialRepository: any
  let mockThrottleService: any
  let mockAuditService: any
  let mockTokenService: any
  let mockSessionStore: any
  let mockAuthUnitOfWork: any
  let useCase: LoginUseCase

  const validUser = new User({
    id: '11111111-1111-4111-8111-111111111111',
    email: 'test@ejemplo.com',
    roles: ['user'],
    status: 'active',
    authzVersion: 1,
    emailVerifiedAt: new Date(),
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  })

  beforeAll(async () => {
    passwordHash = await argon2.hash('correct-password')
  })

  beforeEach(() => {
    mockUserRepository = { findByEmail: vi.fn().mockResolvedValue(validUser) }
    mockCredentialRepository = { findByUserId: vi.fn().mockResolvedValue({ userId: validUser.id, passwordHash }) }

    mockThrottleService = {
      checkLoginAllowed: vi.fn().mockResolvedValue({ accountLocked: false, ipLocked: false }),

      recordLoginFailure: vi.fn().mockResolvedValue({
        accountLocked: false, ipLocked: false, accountAttempts: 1, ipAttempts: 1,
        accountLockTtlSeconds: 0, ipLockTtlSeconds: 0, passwordSprayingDetected: false, distinctAccountsFromIp: 1
      }),

      clearAccountLoginFailures: vi.fn().mockResolvedValue(true)
    }

    mockAuditService = { recordEvent: vi.fn() }

    mockTokenService = {
      generateRefreshToken: vi.fn().mockResolvedValue({ token: 'rt', jti: 'jti', expiresAt: new Date() }),
      generateAccessToken: vi.fn().mockResolvedValue({ token: 'at' })
    }

    mockSessionStore = { storeRefreshToken: vi.fn(), deleteRefreshToken: vi.fn() }

    mockAuthUnitOfWork = {
      run: vi.fn((cb) => cb({
        authAuditService: mockAuditService,
        refreshTokenRepository: { create: vi.fn(), findLatestActiveBySessionId: vi.fn(), revokeAllBySessionId: vi.fn() },
        userRepository: { updateLastLoginAt: vi.fn() },
        userSessionRepository: { countActiveByUserId: vi.fn().mockResolvedValue(0), findOldestActiveByUserId: vi.fn(), revokeBySessionKey: vi.fn(), create: vi.fn().mockResolvedValue({ id: 'sess-1' }) },
        acquireUserMutationLock: vi.fn()
      }))
    }

    useCase = new LoginUseCase(
      mockUserRepository,
      mockCredentialRepository,
      mockTokenService,
      mockSessionStore,
      mockAuditService,
      mockAuthUnitOfWork,
      mockThrottleService
    )
  })

  it('Login con Contraseña Incorrecta y Registro de Evento', async () => {
    await expect(useCase.execute({ email: 'test@ejemplo.com', password: 'wrong-password', ipAddress: '127.0.0.1', userAgent: '', requestId: '' }))
      .rejects.toThrowError(UnauthorizedError)

    // Matchers para verificar que se llamaron a estos metodos almenos una vez durante la ejecución del método execute
    expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('test@ejemplo.com')
    expect(mockThrottleService.recordLoginFailure).toHaveBeenCalled()
    expect(mockTokenService.generateAccessToken).not.toHaveBeenCalled()
    expect(mockAuditService.recordEvent).toHaveBeenCalled()
  })

  it('Login exitoso crea access/refresh, sesion y auditoria', async () => {
    const result = await useCase.execute({ email: 'test@ejemplo.com', password: 'correct-password', ipAddress: '127.0.0.1', userAgent: '', requestId: '' })

    expect(result.accessToken).toBe('at')
    expect(mockTokenService.generateAccessToken).toHaveBeenCalled()
    expect(mockSessionStore.storeRefreshToken).toHaveBeenCalled()
    expect(mockAuthUnitOfWork.run).toHaveBeenCalled()
    expect(mockThrottleService.clearAccountLoginFailures).toHaveBeenCalled()
  })

  it('Usuario inexistente lanza un mensaje genérico', async () => {
    // Para este test, modificamos el return de este mock
    mockUserRepository.findByEmail.mockResolvedValue(null)

    await expect(useCase.execute({ email: 'no_existe@ejemplo.com', password: 'pw', ipAddress: '127.0.0.1', userAgent: '', requestId: '' }))
      .rejects.toThrowError(UnauthorizedError)
  })

  it('Usuario no autenticado es rechazado', async () => {
    // Simulamos un usuario sin autenticación
    mockUserRepository.findByEmail.mockResolvedValue({ id: 'user-1', canAuthenticate: () => false })

    await expect(useCase.execute({ email: 'baneado@ejemplo.com', password: 'pw', ipAddress: '127.0.0.1', userAgent: '', requestId: '' }))
      .rejects.toThrowError(UnauthorizedError)
  })

  it('Throttle bloquea usuario por umbral y registra evento', async () => {
    // Simulamos cuenta bloqueada
    mockThrottleService.checkLoginAllowed.mockResolvedValue({ accountLocked: true, ipLocked: false, accountTtlSeconds: 300, ipTtlSeconds: 0 })

    await expect(useCase.execute({ email: 'spam@ejemplo.com', password: 'pw', ipAddress: '127.0.0.1', userAgent: '', requestId: '' }))
      .rejects.toThrowError('Too many login attempts. Try again later.')

    expect(mockAuditService.recordEvent).toHaveBeenCalled()
  })

  it('Al superar limite de sesiones por usuario, se elimina la más antigua', async () => {
    // Modificamos el UnitOfWork localmente para simular límite excedido
    const revokeOldestSession = vi.fn()
    const revokeOldestTokens = vi.fn()

    mockAuthUnitOfWork.run = vi.fn((cb) => cb({
      authAuditService: mockAuditService,
      refreshTokenRepository: { create: vi.fn(), findLatestActiveBySessionId: vi.fn().mockResolvedValue({ jti: 'old-jti' }), revokeAllBySessionId: revokeOldestTokens },
      userRepository: { updateLastLoginAt: vi.fn() },
      userSessionRepository: { countActiveByUserId: vi.fn().mockResolvedValue(5), findOldestActiveByUserId: vi.fn().mockResolvedValue({ id: 'old-sess', sessionKey: 'old-key' }), revokeBySessionKey: revokeOldestSession, create: vi.fn().mockResolvedValue({ id: 'sess-new' }) },
      acquireUserMutationLock: vi.fn()
    }))

    await useCase.execute({ email: 'test@ejemplo.com', password: 'correct-password', ipAddress: '127.0.0.1', userAgent: '', requestId: '' })

    expect(revokeOldestSession).toHaveBeenCalledWith('old-key', expect.any(Date), 'session_limit_exceeded')
    expect(mockSessionStore.deleteRefreshToken).toHaveBeenCalledWith(validUser.id, 'old-jti')
  })
})