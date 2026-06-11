import { describe, expect, it, vi } from 'vitest'
import argon2 from 'argon2'

import { ForgotPasswordUseCase } from '@/modules/credentials/application/use-cases/ForgotPasswordUseCase.js'
import { ResetPasswordUseCase } from '@/modules/credentials/application/use-cases/ResetPasswordUseCase.js'
import { VerifyEmailUseCase } from '@/modules/credentials/application/use-cases/VerifyEmailUseCase.js'
import { ResendVerificationUseCase } from '@/modules/credentials/application/use-cases/ResendVerificationUseCase.js'
import { ChangePasswordUseCase } from '@/modules/credentials/application/use-cases/ChangePasswordUseCase.js'
import { ChangeEmailUseCase } from '@/modules/credentials/application/use-cases/ChangeEmailUseCase.js'

import { User } from '@/modules/identity/domain/entities/User.js'
import { OneTimeToken } from '@/modules/credentials/domain/entities/OneTimeToken.js'
import { UserCredential } from '@/modules/credentials/domain/entities/UserCredential.js'
import { UnauthorizedError, ConflictError } from '@/shared/errors/HttpErrors.js'

import type {
  AuthRepositories,
  IAuthUnitOfWork,
} from '@/shared/domain/services/IAuthUnitOfWork.js'
import type { IUserRepository } from '@/modules/identity/domain/repositories/IUserRepository.js'
import type { IUserCredentialRepository } from '@/modules/credentials/domain/repositories/IUserCredentialRepository.js'
import type { ISessionStore } from '@/modules/access/domain/services/ISessionStore.js'
import type { ITokenService } from '@/modules/access/domain/services/ITokenService.js'
import type { IAuthEmailService } from '@/modules/credentials/domain/services/IAuthEmailService.js'

// Mock global de la librería argon2
vi.mock('argon2', () => ({
  default: {
    hash: vi.fn(() => Promise.resolve('hashed-value')),
    verify: vi.fn(() => Promise.resolve(true)),
  },
}))

describe('Credentials Use Cases - Pruebas Unitarias de Casos de Uso', () => {
  const mockUser = new User({
    id: '44444444-4444-4444-8444-444444444444',
    email: 'user@example.com',
    roles: ['user'],
    status: 'active',
    authzVersion: 1,
    emailVerifiedAt: new Date('2026-05-01T00:00:00.000Z'),
    lastLoginAt: null,
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    deletedAt: null,
  })

  const mockUnverifiedUser = new User({
    id: '44444444-4444-4444-8444-444444444444',
    email: 'unverified@example.com',
    roles: ['user'],
    status: 'active',
    authzVersion: 1,
    emailVerifiedAt: null,
    lastLoginAt: null,
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    deletedAt: null,
  })

  const mockCredential = new UserCredential({
    id: 'credential-id',
    userId: mockUser.id,
    passwordHash: 'hashed-password-value',
    passwordChangedAt: new Date('2026-05-01T00:00:00.000Z'),
    passwordVersion: 1,
    mustChangePassword: false,
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
  })

  // ==========================================
  // 3.1 ForgotPassword (3 Tests)
  // ==========================================
  describe('ForgotPassword', () => {
    it('1. returns a preview token for an existing account and invalidates prior reset tokens', async () => {
      // Test Migrado: Asegura que invalida previos, genera uno nuevo y retorna previewToken
      const invalidateActiveByUserId = vi.fn(() => Promise.resolve())
      const createOneTimeToken = vi.fn(() =>
        Promise.resolve(
          new OneTimeToken({
            id: '55555555-5555-4555-8555-555555555555',
            userId: mockUser.id,
            type: 'password_reset',
            tokenHash: 'hashed-token',
            requestedByIp: '127.0.0.1',
            expiresAt: new Date('2026-05-01T01:00:00.000Z'),
            usedAt: null,
            createdAt: new Date('2026-05-01T00:00:00.000Z'),
          }),
        ),
      )

      const repositories = {
        oneTimeTokenRepository: {
          invalidateActiveByUserId,
          create: createOneTimeToken,
        },
        authAuditService: {
          recordEvent: vi.fn(() => Promise.resolve()),
        },
      } as unknown as AuthRepositories

      const authUnitOfWork: IAuthUnitOfWork = {
        run: async (callback) => callback(repositories),
      }

      const authEmailService: IAuthEmailService = {
        sendPasswordResetEmail: vi.fn(() =>
          Promise.resolve({
            previewToken: '55555555-5555-4555-8555-555555555555.secret',
          }),
        ),
        sendVerificationEmail: vi.fn(),
      }

      const userRepository = {
        findByEmail: vi.fn(() => Promise.resolve(mockUser)),
      } as unknown as IUserRepository

      const useCase = new ForgotPasswordUseCase(
        userRepository,
        authUnitOfWork,
        authEmailService,
      )

      const result = await useCase.execute({
        email: mockUser.email,
        requestId: '66666666-6666-4666-8666-666666666666',
        userAgent: 'Vitest',
        ipAddress: '127.0.0.1',
      })

      expect(invalidateActiveByUserId).toHaveBeenCalledWith(
        mockUser.id,
        'password_reset',
      )
      expect(authEmailService.sendPasswordResetEmail).toHaveBeenCalled()
      expect(result.previewToken).toBe(
        '55555555-5555-4555-8555-555555555555.secret',
      )
    })

    it('2. returns neutral response for non-existing email', async () => {
      // Test Nuevo: Respuesta neutral si el email no existe (retorna previewToken: null)
      const userRepository = {
        findByEmail: vi.fn(() => Promise.resolve(null)),
      } as unknown as IUserRepository

      const useCase = new ForgotPasswordUseCase(
        userRepository,
        {} as IAuthUnitOfWork,
        {} as IAuthEmailService,
      )

      const result = await useCase.execute({
        email: 'nonexisting@example.com',
        requestId: '66666666-6666-4666-8666-666666666666',
        userAgent: 'Vitest',
        ipAddress: '127.0.0.1',
      })

      expect(result.previewToken).toBeNull()
    })

    it('3. records audit events on successful forgot password request', async () => {
      // Test Nuevo: Verifica el registro del evento en el servicio de auditoría
      const recordEvent = vi.fn(() => Promise.resolve())
      const repositories = {
        oneTimeTokenRepository: {
          invalidateActiveByUserId: vi.fn(() => Promise.resolve()),
          create: vi.fn(() =>
            Promise.resolve(
              new OneTimeToken({
                id: '55555555-5555-4555-8555-555555555555',
                userId: mockUser.id,
                type: 'password_reset',
                tokenHash: 'hashed-token',
                requestedByIp: '127.0.0.1',
                expiresAt: new Date(),
                usedAt: null,
                createdAt: new Date(),
              }),
            ),
          ),
        },
        authAuditService: {
          recordEvent,
        },
      } as unknown as AuthRepositories

      const authUnitOfWork: IAuthUnitOfWork = {
        run: async (callback) => callback(repositories),
      }

      const userRepository = {
        findByEmail: vi.fn(() => Promise.resolve(mockUser)),
      } as unknown as IUserRepository

      const authEmailService = {
        sendPasswordResetEmail: vi.fn(() =>
          Promise.resolve({ previewToken: 'token' }),
        ),
      } as unknown as IAuthEmailService

      const useCase = new ForgotPasswordUseCase(
        userRepository,
        authUnitOfWork,
        authEmailService,
      )

      await useCase.execute({
        email: mockUser.email,
        requestId: 'req-audit-123',
        userAgent: 'Vitest',
        ipAddress: '127.0.0.1',
      })

      expect(recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          eventType: 'password_reset_requested',
          requestId: 'req-audit-123',
        }),
      )
    })
  })

  // ==========================================
  // 3.2 ResetPassword (2 Tests)
  // ==========================================
  describe('ResetPassword', () => {
    it('4. resets password and revokes sessions for valid token', async () => {
      // Test Nuevo: Ejecución correcta de reseteo con token válido y limpieza de sesiones
      const storedToken = new OneTimeToken({
        id: '55555555-5555-4555-8555-555555555555',
        userId: mockUser.id,
        type: 'password_reset',
        tokenHash: 'hashed-token',
        requestedByIp: '127.0.0.1',
        expiresAt: new Date('2026-05-01T01:00:00.000Z'),
        usedAt: null,
        createdAt: new Date('2026-05-01T00:00:00.000Z'),
      })

      const oneTimeTokenRepository = {
        findActiveById: vi.fn(() => Promise.resolve(storedToken)),
        markAsUsed: vi.fn(() => Promise.resolve()),
      }
      const userCredentialRepository = {
        findByUserId: vi.fn(() => Promise.resolve(mockCredential)),
        updatePassword: vi.fn(() => Promise.resolve()),
      }
      const userSessionRepository = {
        revokeAllByUserId: vi.fn(() => Promise.resolve()),
      }
      const refreshTokenRepository = {
        revokeAllByUserId: vi.fn(() => Promise.resolve()),
      }
      const authAuditService = {
        recordEvent: vi.fn(() => Promise.resolve()),
      }
      const acquireUserMutationLock = vi.fn(() => Promise.resolve())

      const repositories = {
        oneTimeTokenRepository,
        userCredentialRepository,
        userSessionRepository,
        refreshTokenRepository,
        authAuditService,
        acquireUserMutationLock,
      } as unknown as AuthRepositories

      const authUnitOfWork: IAuthUnitOfWork = {
        run: async (callback) => callback(repositories),
      }

      const sessionStore = {
        deleteAllRefreshTokens: vi.fn(() => Promise.resolve()),
      } as unknown as ISessionStore

      vi.mocked(argon2.verify).mockResolvedValue(true)

      const useCase = new ResetPasswordUseCase(
        userCredentialRepository as unknown as IUserCredentialRepository,
        sessionStore,
        authUnitOfWork,
      )

      await useCase.execute({
        token: `${storedToken.id}.secret`,
        newPassword: 'new-valid-password',
        requestId: 'req-123',
        userAgent: 'Vitest',
        ipAddress: '127.0.0.1',
      })

      expect(oneTimeTokenRepository.findActiveById).toHaveBeenCalledWith(
        storedToken.id,
        'password_reset',
      )
      expect(oneTimeTokenRepository.markAsUsed).toHaveBeenCalled()
      expect(userCredentialRepository.updatePassword).toHaveBeenCalled()
      expect(userSessionRepository.revokeAllByUserId).toHaveBeenCalled()
      expect(refreshTokenRepository.revokeAllByUserId).toHaveBeenCalled()
      expect(sessionStore.deleteAllRefreshTokens).toHaveBeenCalledWith(
        mockUser.id,
      )
    })

    it('5. throws UnauthorizedError for invalid token', async () => {
      // Test Nuevo: Arroja error 401 si no se encuentra un token activo
      const oneTimeTokenRepository = {
        findActiveById: vi.fn(() => Promise.resolve(null)),
      }
      const repositories = {
        oneTimeTokenRepository,
      } as unknown as AuthRepositories

      const authUnitOfWork: IAuthUnitOfWork = {
        run: async (callback) => callback(repositories),
      }

      const useCase = new ResetPasswordUseCase(
        {} as IUserCredentialRepository,
        {} as ISessionStore,
        authUnitOfWork,
      )

      await expect(
        useCase.execute({
          token: '55555555-5555-4555-8555-555555555555.secret',
          newPassword: 'new-valid-password',
          requestId: 'req-123',
          userAgent: 'Vitest',
          ipAddress: '127.0.0.1',
        }),
      ).rejects.toThrow(UnauthorizedError)
    })
  })

  // ==========================================
  // 3.3 VerifyEmail (2 Tests)
  // ==========================================
  describe('VerifyEmail', () => {
    it('6. verifies email for valid token', async () => {
      // Test Nuevo: Ejecución correcta de verificación para usuario no verificado
      const storedToken = new OneTimeToken({
        id: '55555555-5555-4555-8555-555555555555',
        userId: mockUnverifiedUser.id,
        type: 'email_verification',
        tokenHash: 'hashed-token',
        requestedByIp: '127.0.0.1',
        expiresAt: new Date('2026-05-01T01:00:00.000Z'),
        usedAt: null,
        createdAt: new Date('2026-05-01T00:00:00.000Z'),
      })

      const oneTimeTokenRepository = {
        findActiveById: vi.fn(() => Promise.resolve(storedToken)),
        markAsUsed: vi.fn(() => Promise.resolve()),
      }
      const userRepository = {
        findById: vi.fn(() => Promise.resolve(mockUnverifiedUser)),
        markEmailAsVerified: vi.fn(() => Promise.resolve()),
      }
      const authAuditService = {
        recordEvent: vi.fn(() => Promise.resolve()),
      }
      const acquireUserMutationLock = vi.fn(() => Promise.resolve())

      const repositories = {
        oneTimeTokenRepository,
        userRepository,
        authAuditService,
        acquireUserMutationLock,
      } as unknown as AuthRepositories

      const authUnitOfWork: IAuthUnitOfWork = {
        run: async (callback) => callback(repositories),
      }

      vi.mocked(argon2.verify).mockResolvedValue(true)

      const useCase = new VerifyEmailUseCase(authUnitOfWork)

      await useCase.execute({
        token: `${storedToken.id}.secret`,
        requestId: 'req-123',
        userAgent: 'Vitest',
        ipAddress: '127.0.0.1',
      })

      expect(oneTimeTokenRepository.markAsUsed).toHaveBeenCalled()
      expect(userRepository.markEmailAsVerified).toHaveBeenCalledWith(
        mockUnverifiedUser.id,
        expect.any(Date),
      )
    })

    it('7. throws UnauthorizedError for invalid token', async () => {
      // Test Nuevo: Arroja error si no se encuentra el token de verificación
      const oneTimeTokenRepository = {
        findActiveById: vi.fn(() => Promise.resolve(null)),
      }
      const repositories = {
        oneTimeTokenRepository,
      } as unknown as AuthRepositories

      const authUnitOfWork: IAuthUnitOfWork = {
        run: async (callback) => callback(repositories),
      }

      const useCase = new VerifyEmailUseCase(authUnitOfWork)

      await expect(
        useCase.execute({
          token: '55555555-5555-4555-8555-555555555555.secret',
          requestId: 'req-123',
          userAgent: 'Vitest',
          ipAddress: '127.0.0.1',
        }),
      ).rejects.toThrow(UnauthorizedError)
    })
  })

  // ==========================================
  // 3.4 ResendVerification (2 Tests)
  // ==========================================
  describe('ResendVerification', () => {
    it('8. invalidates prior tokens and creates new for unverified user', async () => {
      // Test Nuevo: Invalida previos y reenvía correo para un usuario con emailVerifiedAt = null
      const userRepository = {
        findByEmail: vi.fn(() => Promise.resolve(mockUnverifiedUser)),
      } as unknown as IUserRepository

      const createdToken = new OneTimeToken({
        id: 'new-token-id',
        userId: mockUnverifiedUser.id,
        type: 'email_verification',
        tokenHash: 'new-hash',
        requestedByIp: '127.0.0.1',
        expiresAt: new Date('2026-05-02T00:00:00.000Z'),
        usedAt: null,
        createdAt: new Date(),
      })

      const oneTimeTokenRepository = {
        invalidateActiveByUserId: vi.fn(() => Promise.resolve()),
        create: vi.fn(() => Promise.resolve(createdToken)),
      }
      const authAuditService = {
        recordEvent: vi.fn(() => Promise.resolve()),
      }
      const acquireUserMutationLock = vi.fn(() => Promise.resolve())

      const repositories = {
        oneTimeTokenRepository,
        authAuditService,
        acquireUserMutationLock,
      } as unknown as AuthRepositories

      const authUnitOfWork: IAuthUnitOfWork = {
        run: async (callback) => callback(repositories),
      }

      const authEmailService: IAuthEmailService = {
        sendPasswordResetEmail: vi.fn(),
        sendVerificationEmail: vi.fn(() =>
          Promise.resolve({
            previewToken: 'new-token-id.secret',
          }),
        ),
      }

      const useCase = new ResendVerificationUseCase(
        userRepository,
        authUnitOfWork,
        authEmailService,
      )

      const result = await useCase.execute({
        email: mockUnverifiedUser.email,
        requestId: 'req-123',
        userAgent: 'Vitest',
        ipAddress: '127.0.0.1',
      })

      expect(
        oneTimeTokenRepository.invalidateActiveByUserId,
      ).toHaveBeenCalledWith(mockUnverifiedUser.id, 'email_verification')
      expect(result.previewToken).toBe('new-token-id.secret')
    })

    it('9. returns neutrally for already verified user', async () => {
      // Test Nuevo: Si el email ya está verificado, retorna previewToken: null neutralmente
      const userRepository = {
        findByEmail: vi.fn(() => Promise.resolve(mockUser)),
      } as unknown as IUserRepository

      const useCase = new ResendVerificationUseCase(
        userRepository,
        {} as IAuthUnitOfWork,
        {} as IAuthEmailService,
      )

      const result = await useCase.execute({
        email: mockUser.email,
        requestId: 'req-123',
        userAgent: 'Vitest',
        ipAddress: '127.0.0.1',
      })

      expect(result.previewToken).toBeNull()
    })
  })

  // ==========================================
  // 3.5 ChangePassword (3 Tests)
  // ==========================================
  describe('ChangePassword', () => {
    it('10. throws UnauthorizedError for incorrect current password', async () => {
      // Test Nuevo: Lanza error de no autorizado si la contraseña actual no concuerda
      const userRepository = {
        findById: vi.fn(() => Promise.resolve(mockUser)),
      } as unknown as IUserRepository
      const userCredentialRepository = {
        findByUserId: vi.fn(() => Promise.resolve(mockCredential)),
      } as unknown as IUserCredentialRepository

      vi.mocked(argon2.verify).mockResolvedValue(false)

      const useCase = new ChangePasswordUseCase(
        userRepository,
        userCredentialRepository,
        {} as ITokenService,
        {} as ISessionStore,
        {} as IAuthUnitOfWork,
      )

      await expect(
        useCase.execute({
          userId: mockUser.id,
          currentPassword: 'wrong-password',
          newPassword: 'new-valid-password',
          accessToken: 'token',
          sessionKey: 'session',
          requestId: 'req-123',
          userAgent: 'Vitest',
          ipAddress: '127.0.0.1',
        }),
      ).rejects.toThrow(UnauthorizedError)
    })

    it('11. updates password and revokes sessions on valid request', async () => {
      // Test Nuevo: Ejecuta cambio de password e incrementa versión de contraseña y revoca tokens de refresco
      const userRepository = {
        findById: vi.fn(() => Promise.resolve(mockUser)),
      } as unknown as IUserRepository
      const userCredentialRepository = {
        findByUserId: vi.fn(() => Promise.resolve(mockCredential)),
        updatePassword: vi.fn(() => Promise.resolve()),
      }
      const userSessionRepository = {
        revokeAllByUserId: vi.fn(() => Promise.resolve()),
      }
      const refreshTokenRepository = {
        revokeAllByUserId: vi.fn(() => Promise.resolve()),
      }
      const authAuditService = {
        recordEvent: vi.fn(() => Promise.resolve()),
      }
      const acquireUserMutationLock = vi.fn(() => Promise.resolve())

      const repositories = {
        userCredentialRepository,
        userSessionRepository,
        refreshTokenRepository,
        authAuditService,
        acquireUserMutationLock,
      } as unknown as AuthRepositories

      const authUnitOfWork: IAuthUnitOfWork = {
        run: async (callback) => callback(repositories),
      }

      const sessionStore = {
        deleteAllRefreshTokens: vi.fn(() => Promise.resolve()),
      } as unknown as ISessionStore

      vi.mocked(argon2.verify).mockResolvedValue(true)

      const useCase = new ChangePasswordUseCase(
        userRepository,
        userCredentialRepository as unknown as IUserCredentialRepository,
        {} as ITokenService,
        sessionStore,
        authUnitOfWork,
      )

      await useCase.execute({
        userId: mockUser.id,
        currentPassword: 'correct-password',
        newPassword: 'new-valid-password',
        accessToken: null,
        sessionKey: 'session-key',
        requestId: 'req-123',
        userAgent: 'Vitest',
        ipAddress: '127.0.0.1',
      })

      expect(userCredentialRepository.updatePassword).toHaveBeenCalled()
      expect(userSessionRepository.revokeAllByUserId).toHaveBeenCalled()
      expect(sessionStore.deleteAllRefreshTokens).toHaveBeenCalledWith(
        mockUser.id,
      )
    })

    it('12. blacklists the current access token when provided', async () => {
      // Test Nuevo: Si se provee accessToken, lo blacklistea usando tokenService y sessionStore
      const userRepository = {
        findById: vi.fn(() => Promise.resolve(mockUser)),
      } as unknown as IUserRepository
      const userCredentialRepository = {
        findByUserId: vi.fn(() => Promise.resolve(mockCredential)),
        updatePassword: vi.fn(() => Promise.resolve()),
      }
      const acquireUserMutationLock = vi.fn(() => Promise.resolve())

      const repositories = {
        userCredentialRepository,
        userSessionRepository: {
          revokeAllByUserId: vi.fn(() => Promise.resolve()),
        },
        refreshTokenRepository: {
          revokeAllByUserId: vi.fn(() => Promise.resolve()),
        },
        authAuditService: { recordEvent: vi.fn(() => Promise.resolve()) },
        acquireUserMutationLock,
      } as unknown as AuthRepositories

      const authUnitOfWork: IAuthUnitOfWork = {
        run: async (callback) => callback(repositories),
      }

      const tokenService = {
        decodeAccessToken: vi.fn(() => ({
          jti: 'jti-blacklist-123',
          exp: Math.floor(Date.now() / 1000) + 120, // Expira en 120 segundos
        })),
      } as unknown as ITokenService

      const sessionStore = {
        blacklistAccessToken: vi.fn(() => Promise.resolve()),
        deleteAllRefreshTokens: vi.fn(() => Promise.resolve()),
      } as unknown as ISessionStore

      vi.mocked(argon2.verify).mockResolvedValue(true)

      const useCase = new ChangePasswordUseCase(
        userRepository,
        userCredentialRepository as unknown as IUserCredentialRepository,
        tokenService,
        sessionStore,
        authUnitOfWork,
      )

      await useCase.execute({
        userId: mockUser.id,
        currentPassword: 'correct-password',
        newPassword: 'new-valid-password',
        accessToken: 'valid-access-token',
        sessionKey: 'session-key',
        requestId: 'req-123',
        userAgent: 'Vitest',
        ipAddress: '127.0.0.1',
      })

      expect(tokenService.decodeAccessToken).toHaveBeenCalledWith(
        'valid-access-token',
      )
      expect(sessionStore.blacklistAccessToken).toHaveBeenCalledWith(
        'jti-blacklist-123',
        expect.any(Number),
      )
    })
  })

  // ==========================================
  // 3.6 ChangeEmail (2 Tests)
  // ==========================================
  describe('ChangeEmail', () => {
    it('13. changes email and sends verification with session revocation', async () => {
      // Test Nuevo: Flujo de cambio de email con re-verificación pendiente y destrucción de sesiones
      const newEmail = 'newemail@example.com'

      const userRepository = {
        findById: vi.fn(() => Promise.resolve(mockUser)),
        findByEmail: vi.fn(() => Promise.resolve(null)),
        updateEmailForReverification: vi.fn(() => Promise.resolve()),
      }
      const oneTimeTokenRepository = {
        invalidateActiveByUserId: vi.fn(() => Promise.resolve()),
        create: vi.fn(() =>
          Promise.resolve({
            id: 'verification-token-id',
          }),
        ),
      }
      const userSessionRepository = {
        revokeAllByUserId: vi.fn(() => Promise.resolve()),
      }
      const refreshTokenRepository = {
        revokeAllByUserId: vi.fn(() => Promise.resolve()),
      }
      const authAuditService = {
        recordEvent: vi.fn(() => Promise.resolve()),
      }
      const acquireUserMutationLock = vi.fn(() => Promise.resolve())

      const repositories = {
        userRepository,
        oneTimeTokenRepository,
        userSessionRepository,
        refreshTokenRepository,
        authAuditService,
        acquireUserMutationLock,
      } as unknown as AuthRepositories

      const authUnitOfWork: IAuthUnitOfWork = {
        run: async (callback) => callback(repositories),
      }

      const tokenService = {
        decodeAccessToken: vi.fn(() => ({
          jti: 'jti-123',
          exp: Math.floor(Date.now() / 1000) + 3600,
        })),
      } as unknown as ITokenService

      const sessionStore = {
        blacklistAccessToken: vi.fn(() => Promise.resolve()),
        deleteAllRefreshTokens: vi.fn(() => Promise.resolve()),
      } as unknown as ISessionStore

      const authEmailService: IAuthEmailService = {
        sendPasswordResetEmail: vi.fn(),
        sendVerificationEmail: vi.fn(() =>
          Promise.resolve({
            previewToken: 'verification-token-id.secret',
          }),
        ),
      }

      const useCase = new ChangeEmailUseCase(
        tokenService,
        sessionStore,
        authUnitOfWork,
        authEmailService,
      )

      const result = await useCase.execute({
        userId: mockUser.id,
        email: newEmail,
        accessToken: 'valid-access-token',
        sessionKey: 'session-key',
        requestId: 'req-123',
        userAgent: 'Vitest',
        ipAddress: '127.0.0.1',
      })

      expect(userRepository.updateEmailForReverification).toHaveBeenCalledWith({
        userId: mockUser.id,
        email: newEmail,
        updatedAt: expect.any(Date),
      })
      expect(oneTimeTokenRepository.create).toHaveBeenCalled()
      expect(userSessionRepository.revokeAllByUserId).toHaveBeenCalled()
      expect(sessionStore.blacklistAccessToken).toHaveBeenCalled()
      expect(sessionStore.deleteAllRefreshTokens).toHaveBeenCalledWith(
        mockUser.id,
      )
      expect(result.previewToken).toBe('verification-token-id.secret')
    })

    it('14. throws ConflictError for email already in use', async () => {
      // Test Nuevo: Lanza ConflictError 409 si el nuevo correo ya pertenece a otra persona
      const newEmail = 'inuse@example.com'
      const anotherUser = new User({
        id: 'another-user-id',
        email: newEmail,
        roles: ['user'],
        status: 'active',
        authzVersion: 1,
        emailVerifiedAt: new Date(),
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      })

      const userRepository = {
        findById: vi.fn(() => Promise.resolve(mockUser)),
        findByEmail: vi.fn(() => Promise.resolve(anotherUser)),
      }
      const acquireUserMutationLock = vi.fn(() => Promise.resolve())

      const repositories = {
        userRepository,
        acquireUserMutationLock,
      } as unknown as AuthRepositories

      const authUnitOfWork: IAuthUnitOfWork = {
        run: async (callback) => callback(repositories),
      }

      const useCase = new ChangeEmailUseCase(
        {} as ITokenService,
        {} as ISessionStore,
        authUnitOfWork,
        {} as IAuthEmailService,
      )

      await expect(
        useCase.execute({
          userId: mockUser.id,
          email: newEmail,
          accessToken: null,
          sessionKey: 'session-key',
          requestId: 'req-123',
          userAgent: 'Vitest',
          ipAddress: '127.0.0.1',
        }),
      ).rejects.toThrow(ConflictError)
    })
  })
})
