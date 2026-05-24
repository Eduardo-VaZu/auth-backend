import { describe, expect, it, vi } from 'vitest'
import { RefreshTokenUseCase } from '@/modules/access/application/use-cases/RefreshTokenUseCase.js'
import { UnauthorizedError } from '@/shared/errors/HttpErrors.js'

describe('RefreshTokenUseCase', () => {
  it('Caso CP-04: Refresco de Token Expirado', async () => {
    // Setup
    const expiredToken = 'some-expired-token'
    const payload = {
      userId: 'user-123',
      jti: 'jti-123',
      exp: Math.floor(Date.now() / 1000) - 3600, // expired in payload
    }

    const verifyRefreshToken = vi.fn(() => Promise.resolve(payload))
    
    // El repositorio devuelve que el token ya expiró en su metadata
    const findByJti = vi.fn(() =>
      Promise.resolve({
        id: 'token-uuid',
        jti: 'jti-123',
        userId: 'user-123',
        sessionId: 'session-uuid',
        tokenHash: 'hashed',
        expiresAt: new Date(Date.now() - 1000), // expired in database metadata
        revokedAt: null,
        replacedByTokenId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    )

    // El token aún existe en Redis
    const hasRefreshToken = vi.fn(() => Promise.resolve(true))
    const deleteRefreshToken = vi.fn(() => Promise.resolve())

    const refreshTokenRepository = {
      findByJti,
      revokeActiveByJti: vi.fn(),
      create: vi.fn(),
    }

    const tokenService = {
      verifyRefreshToken,
      generateAccessToken: vi.fn(),
      generateRefreshToken: vi.fn(),
    }

    const sessionStore = {
      hasRefreshToken,
      deleteRefreshToken,
    }

    const authUnitOfWork = {
      run: vi.fn(),
    }

    const useCase = new RefreshTokenUseCase(
      refreshTokenRepository as any,
      {} as any,
      tokenService as any,
      sessionStore as any,
      authUnitOfWork as any,
    )

    // Act & Assert
    // Respuesta con código de error de sesión expirada y denegación del nuevo AccessToken
    await expect(
      useCase.execute({
        refreshToken: expiredToken,
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla',
        requestId: 'req-123',
      })
    ).rejects.toThrowError(UnauthorizedError)

    expect(verifyRefreshToken).toHaveBeenCalledWith(expiredToken)
    expect(findByJti).toHaveBeenCalledWith('jti-123')
    expect(hasRefreshToken).toHaveBeenCalledWith('user-123', 'jti-123')

    // Revocación automática de la sesión en el SessionStore (Redis)
    expect(deleteRefreshToken).toHaveBeenCalledWith('user-123', 'jti-123')

    // Denegación del nuevo AccessToken
    expect(tokenService.generateAccessToken).not.toHaveBeenCalled()
  })
})
