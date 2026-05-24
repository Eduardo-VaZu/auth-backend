import { describe, expect, it, vi } from 'vitest'
import { LogoutUseCase } from '@/modules/access/application/use-cases/LogoutUseCase.js'

describe('LogoutUseCase', () => {
  it('Caso CP-05: Cierre de Sesión Única (Logout)', async () => {
    // Setup mocks
    const decodeAccessToken = vi.fn(() => null)
    
    const verifyRefreshToken = vi.fn(() =>
      Promise.resolve({
        userId: 'user-123',
        jti: 'jti-123',
        exp: 9999999999,
      })
    )

    const findByJti = vi.fn(() =>
      Promise.resolve({
        id: 'token-uuid',
        jti: 'jti-123',
        userId: 'user-123',
        sessionId: 'session-uuid',
        tokenHash: 'hashed',
        expiresAt: new Date(),
        revokedAt: null,
        replacedByTokenId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    )

    const revokeByJti = vi.fn(() => Promise.resolve())
    const revokeBySessionKey = vi.fn(() => Promise.resolve())
    const findById = vi.fn(() =>
      Promise.resolve({
        id: 'session-uuid',
        userId: 'user-123',
        sessionKey: 'session-key-123',
        isActive: () => true,
      })
    )

    const tokenService = {
      decodeAccessToken,
      verifyRefreshToken,
    }

    const deleteRefreshToken = vi.fn(() => Promise.resolve())
    const sessionStore = {
      deleteRefreshToken,
      blacklistAccessToken: vi.fn(),
    }

    const recordEvent = vi.fn(() => Promise.resolve())
    const acquireUserMutationLock = vi.fn(() => Promise.resolve())

    const repositories = {
      refreshTokenRepository: {
        findByJti,
        revokeByJti,
      },
      userSessionRepository: {
        findById,
        revokeBySessionKey,
      },
      authAuditService: {
        recordEvent,
      },
      acquireUserMutationLock,
    }

    const authUnitOfWork = {
      run: vi.fn(async (callback) => callback(repositories)),
    }

    const useCase = new LogoutUseCase(
      tokenService as any,
      sessionStore as any,
      authUnitOfWork as any,
    )

    // Act
    await useCase.execute({
      userId: 'user-123',
      sessionKey: null,
      accessToken: null,
      refreshToken: 'some-valid-refresh-token',
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla',
      requestId: 'req-123',
    })

    // Assert
    // 1. Localizar el registro correspondiente en UserSessionRepository (mediante sessionId asociado al token)
    expect(findByJti).toHaveBeenCalledWith('jti-123')
    expect(findById).toHaveBeenCalledWith('session-uuid')

    // 2. Marcado de la sesión como revoked en la base de datos.
    expect(revokeByJti).toHaveBeenCalledWith({
      jti: 'jti-123',
      revokedReason: 'logout',
    })
    expect(revokeBySessionKey).toHaveBeenCalledWith(
      'session-key-123',
      expect.any(Date),
      'logout',
    )

    // 3. Eliminación inmediata de la clave de sesión en el almacén de Redis para invalidar el acceso instantáneamente.
    expect(deleteRefreshToken).toHaveBeenCalledWith('user-123', 'jti-123')
  })
})
