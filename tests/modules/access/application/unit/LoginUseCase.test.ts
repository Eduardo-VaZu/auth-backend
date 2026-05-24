import { describe, expect, it, vi } from 'vitest'
import argon2 from 'argon2'
import { LoginUseCase } from '@/modules/access/application/use-cases/LoginUseCase.js'
import { User } from '@/modules/identity/domain/entities/User.js'
import { UnauthorizedError } from '@/shared/errors/HttpErrors.js'

import type { IUserRepository } from '@/modules/identity/domain/repositories/IUserRepository.js'
import type { IUserCredentialRepository } from '@/modules/credentials/domain/repositories/IUserCredentialRepository.js'
import type { ITokenService } from '@/modules/access/domain/services/ITokenService.js'
import type { ISessionStore } from '@/modules/access/domain/services/ISessionStore.js'
import type { IAuthAuditService } from '@/modules/audit/domain/services/IAuthAuditService.js'
import type { IAuthUnitOfWork } from '@/shared/domain/services/IAuthUnitOfWork.js'
import type { ISecurityThrottleService } from '@/modules/access/domain/services/ISecurityThrottleService.js'

describe('LoginUseCase', () => {
  it('Caso CP-03: Login con Credenciales Inválidas', async () => {
    // Generate a valid Argon2 hash to avoid byteLength / format errors in argon2.verify
    const passwordHash = await argon2.hash('correct-password')

    // 1. Setup mocks
    const user = new User({
      id: '11111111-1111-4111-8111-111111111111',
      email: 'ya_registrado@ejemplo.com',
      roles: ['user'],
      status: 'active',
      authzVersion: 1,
      emailVerifiedAt: new Date(),
      lastLoginAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    })

    const findByEmail = vi.fn(() => Promise.resolve(user))
    const findByUserId = vi.fn(() =>
      Promise.resolve({
        id: '22222222-2222-4222-8222-222222222222',
        userId: user.id,
        passwordHash, // valid argon2 hash
        passwordChangedAt: new Date(),
        passwordVersion: 1,
        mustChangePassword: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    )

    const checkLoginAllowed = vi.fn(() =>
      Promise.resolve({
        accountLocked: false,
        ipLocked: false,
        accountTtlSeconds: 0,
        ipTtlSeconds: 0,
      }),
    )
    const recordLoginFailure = vi.fn(() =>
      Promise.resolve({
        accountLocked: false,
        ipLocked: false,
        accountAttempts: 1,
        ipAttempts: 1,
        accountLockTtlSeconds: 0,
        ipLockTtlSeconds: 0,
        passwordSprayingDetected: false,
        distinctAccountsFromIp: 1,
      }),
    )

    const recordEvent = vi.fn(() => Promise.resolve())

    const securityThrottleService = {
      checkLoginAllowed,
      recordLoginFailure,
      clearAccountLoginFailures: vi.fn(),
    }

    const authAuditService = {
      recordEvent,
    }

    const tokenService = {
      generateRefreshToken: vi.fn(),
      generateAccessToken: vi.fn(),
    }

    const sessionStore = {
      storeRefreshToken: vi.fn(),
      deleteRefreshToken: vi.fn(),
    }

    const authUnitOfWork = {
      run: vi.fn(),
    }

    const useCase = new LoginUseCase(
      { findByEmail } as unknown as IUserRepository,
      { findByUserId } as unknown as IUserCredentialRepository,
      tokenService as unknown as ITokenService,
      sessionStore as unknown as ISessionStore,
      authAuditService as unknown as IAuthAuditService,
      authUnitOfWork,
      securityThrottleService,
    )

    // Act & Assert
    // Detectar discrepancia en la validación -> debe lanzar UnauthorizedError
    await expect(
      useCase.execute({
        email: 'ya_registrado@ejemplo.com',
        password: 'wrong-password',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        requestId: '33333333-3333-4333-8333-333333333333',
      }),
    ).rejects.toThrowError(UnauthorizedError)

    // Validar la existencia del usuario mediante userRepository
    expect(findByEmail).toHaveBeenCalledWith('ya_registrado@ejemplo.com')
    expect(findByUserId).toHaveBeenCalledWith(user.id)

    // Incremento del contador de fallos en SecurityThrottleService
    expect(recordLoginFailure).toHaveBeenCalledWith(
      'ya_registrado@ejemplo.com',
      '127.0.0.1',
    )

    // No debe crear tokens ni sesiones
    expect(tokenService.generateAccessToken).not.toHaveBeenCalled()
    expect(tokenService.generateRefreshToken).not.toHaveBeenCalled()
  })
})
