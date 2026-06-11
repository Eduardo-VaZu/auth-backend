import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import argon2 from 'argon2'
import { RefreshTokenUseCase } from '@/modules/access/application/use-cases/RefreshTokenUseCase.js'
import { UnauthorizedError } from '@/shared/errors/HttpErrors.js'

import type { IRefreshTokenRepository } from '@/modules/access/domain/repositories/IRefreshTokenRepository.js'
import type { IUserRepository } from '@/modules/identity/domain/repositories/IUserRepository.js'
import type { ITokenService } from '@/modules/access/domain/services/ITokenService.js'
import type { ISessionStore } from '@/modules/access/domain/services/ISessionStore.js'
import type { IAuthUnitOfWork } from '@/shared/domain/services/IAuthUnitOfWork.js'

describe('RefreshTokenUseCase', () => {
  let validTokenHash: string
  const RAW_VALID_TOKEN = 'valid-refresh-token'

  let mockRefreshTokenRepo: any
  let mockUserRepo: any
  let mockTokenService: any
  let mockSessionStore: any
  let mockAuthUnitOfWork: any
  let useCase: RefreshTokenUseCase

  const baseUserId = 'user-123'
  const baseJti = 'jti-123'
  let defaultDbToken: any

  beforeAll(async () => {
    validTokenHash = await argon2.hash(RAW_VALID_TOKEN)
  })

  beforeEach(() => {
    defaultDbToken = {
      id: 'token-uuid', jti: baseJti, userId: baseUserId, sessionId: 'session-uuid',
      tokenHash: validTokenHash, expiresAt: new Date(Date.now() + 10000),
      revokedAt: null, replacedByTokenId: null,
    }

    mockRefreshTokenRepo = {
      findByJti: vi.fn().mockResolvedValue(defaultDbToken),
      create: vi.fn().mockResolvedValue({ id: 'new-rt-id' }),
      revokeActiveByJti: vi.fn().mockResolvedValue({ id: 'old-rt-id' }),
      revokeAllByUserId: vi.fn()
    }

    mockUserRepo = {
      findById: vi.fn().mockResolvedValue({ id: baseUserId, canAuthenticate: () => true, roles: ['user'], authzVersion: 1 })
    }

    mockTokenService = {
      verifyRefreshToken: vi.fn().mockResolvedValue({ userId: baseUserId, jti: baseJti, exp: 9999999999 }),
      generateAccessToken: vi.fn().mockResolvedValue({ token: 'new-access' }),
      generateRefreshToken: vi.fn().mockResolvedValue({ token: 'new-refresh', jti: 'new-jti', expiresAt: new Date(), ttlSeconds: 3600 })
    }

    mockSessionStore = {
      hasRefreshToken: vi.fn().mockResolvedValue(true),
      storeRefreshToken: vi.fn(),
      deleteRefreshToken: vi.fn(),
      deleteAllRefreshTokens: vi.fn()
    }

    mockAuthUnitOfWork = {
      run: vi.fn((cb) => cb({
        userSessionRepository: { findById: vi.fn().mockResolvedValue({ isActive: () => true, userId: baseUserId, sessionKey: 'sess-key' }), rotateSession: vi.fn(), revokeAllByUserId: vi.fn() },
        refreshTokenRepository: mockRefreshTokenRepo,
        authAuditService: { recordEvent: vi.fn() },
        acquireUserMutationLock: vi.fn()
      }))
    }

    useCase = new RefreshTokenUseCase(
      mockRefreshTokenRepo as unknown as IRefreshTokenRepository,
      mockUserRepo as unknown as IUserRepository,
      mockTokenService as unknown as ITokenService,
      mockSessionStore as unknown as ISessionStore,
      mockAuthUnitOfWork as unknown as IAuthUnitOfWork
    )
  })

  it('Rechazar al expirar Refresh Token', async () => {
    // Simulamos que el token ya expiró hace un segundo
    mockRefreshTokenRepo.findByJti.mockResolvedValue({ ...defaultDbToken, expiresAt: new Date(Date.now() - 1000) })

    await expect(useCase.execute({ refreshToken: RAW_VALID_TOKEN, ipAddress: '127.0.0.1', userAgent: '', requestId: '' }))
      .rejects.toThrowError(UnauthorizedError)

    expect(mockSessionStore.deleteRefreshToken).toHaveBeenCalledWith(baseUserId, baseJti)
    // not para verificar que no haya sido llamado el metodo
    expect(mockTokenService.generateAccessToken).not.toHaveBeenCalled()
  })

  it('Refresh token válido renueva la sesión del usuario', async () => {
    const result = await useCase.execute({ refreshToken: RAW_VALID_TOKEN, ipAddress: '127.0.0.1', userAgent: '', requestId: '' })

    expect(result.accessToken).toBe('new-access')
    expect(result.refreshToken).toBe('new-refresh')
    expect(mockAuthUnitOfWork.run).toHaveBeenCalled()
    expect(mockSessionStore.deleteRefreshToken).toHaveBeenCalledWith(baseUserId, baseJti)
  })

  it('Incidente de no coincidencia en el hasheo del token', async () => {
    // Enviamos un token diferente al que usamos para forzar el incidente
    await expect(useCase.execute({ refreshToken: 'token-falso-o-robado', ipAddress: '127.0.0.1', userAgent: '', requestId: '' }))
      .rejects.toThrowError(UnauthorizedError)

    expect(mockAuthUnitOfWork.run).toHaveBeenCalled()
    expect(mockSessionStore.deleteAllRefreshTokens).toHaveBeenCalledWith(baseUserId)
  })

  it('Conflicto de rotacion concurrente se maneja correctamente', async () => {
    // Simulamos que al intentar revocar el token en BD, retorna null, en caso alguien más ya lo hizo simultaneamente
    mockAuthUnitOfWork.run = vi.fn((cb) => cb({
      userSessionRepository: {
        findById: vi.fn().mockResolvedValue({ isActive: () => true, userId: baseUserId, sessionKey: 'sess-key' }),
        revokeAllByUserId: vi.fn()
      },
      refreshTokenRepository: { ...mockRefreshTokenRepo, revokeActiveByJti: vi.fn().mockResolvedValue(null) },
      authAuditService: { recordEvent: vi.fn() },
      acquireUserMutationLock: vi.fn()
    }))

    await expect(useCase.execute({ refreshToken: RAW_VALID_TOKEN, ipAddress: '127.0.0.1', userAgent: '', requestId: '' }))
      .rejects.toThrowError(UnauthorizedError)

    expect(mockSessionStore.deleteAllRefreshTokens).toHaveBeenCalledWith(baseUserId)
  })

  it('Reuso explícito de un token ya revocado debe revocar todas las sesiones y tokens', async () => {
    // Simulamos que el token existe, pero ya está como revocado
    mockRefreshTokenRepo.findByJti.mockResolvedValue({ ...defaultDbToken, revokedAt: new Date(), replacedByTokenId: 'new-token-uuid' })

    const revokeAllSessions = vi.fn()
    const revokeAllTokens = vi.fn()
    const recordEvent = vi.fn()

    mockAuthUnitOfWork.run = vi.fn((cb) => cb({
      userSessionRepository: { revokeAllByUserId: revokeAllSessions },
      refreshTokenRepository: { revokeAllByUserId: revokeAllTokens },
      authAuditService: { recordEvent },
      acquireUserMutationLock: vi.fn()
    }))

    await expect(useCase.execute({ refreshToken: RAW_VALID_TOKEN, ipAddress: '127.0.0.1', userAgent: '', requestId: '' }))
      .rejects.toThrowError(UnauthorizedError)

    expect(revokeAllSessions).toHaveBeenCalledWith(baseUserId, expect.any(Date), 'refresh_token_reuse_detected')
    expect(revokeAllTokens).toHaveBeenCalledWith({ userId: baseUserId, revokedReason: 'refresh_token_reuse_detected' })
    expect(mockSessionStore.deleteAllRefreshTokens).toHaveBeenCalledWith(baseUserId)
    expect(recordEvent).toHaveBeenCalled()
  })
})