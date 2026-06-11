import { describe, expect, it, vi } from 'vitest'
import { ListSessionsUseCase } from '@/modules/access/application/use-cases/ListSessionsUseCase.js'
import { RevokeSessionUseCase } from '@/modules/access/application/use-cases/RevokeSessionUseCase.js'
import { LogoutUseCase } from '@/modules/access/application/use-cases/LogoutUseCase.js'
import { LogoutAllUseCase } from '@/modules/access/application/use-cases/LogoutAllUseCase.js'
import { NotFoundError, UnauthorizedError } from '@/shared/errors/HttpErrors.js'
import type { ITokenService } from '@/modules/access/domain/services/ITokenService.js'
import type { ISessionStore } from '@/modules/access/domain/services/ISessionStore.js'
import type { IAuthUnitOfWork } from '@/shared/domain/services/IAuthUnitOfWork.js'
import type { IUserSessionRepository } from '@/modules/access/domain/repositories/IUserSessionRepository.js'
import { UserSession } from '@/modules/access/domain/entities/UserSession.js'
import { RefreshToken } from '@/modules/access/domain/entities/RefreshToken.js'

/**
 * Pruebas unitarias para los Casos de Uso del ciclo de vida de sesiones y cierre de sesión (Logout).
 * Utiliza dobles de prueba (mocks) para aislar la lógica de los servicios e infraestructura externos.
 */
describe('SessionUseCases Unit Tests', () => {
  /**
   * Pruebas para ListSessionsUseCase.
   * Verifica la correcta obtención de sesiones del usuario y el marcado de la sesión actual.
   */
  describe('ListSessionsUseCase', () => {
    it('should list active sessions and correctly mark the current session', async () => {
      // Mock de repositorio de sesiones de usuario que retorna dos sesiones activas.
      const userSessionRepository = {
        listActiveByUserId: vi.fn(() =>
          Promise.resolve([
            new UserSession({
              id: 'sess-1',
              userId: 'user-123',
              sessionKey: 'key-current',
              authzVersion: 1,
              deviceName: 'Device 1',
              deviceFingerprint: 'fp1',
              userAgent: 'Mozilla',
              ipAddress: '127.0.0.1',
              lastActivityAt: new Date(),
              expiresAt: new Date(Date.now() + 36000),
              revokedAt: null,
              revokedReason: null,
              createdAt: new Date(),
            }),
            new UserSession({
              id: 'sess-2',
              userId: 'user-123',
              sessionKey: 'key-other',
              authzVersion: 1,
              deviceName: 'Device 2',
              deviceFingerprint: 'fp2',
              userAgent: 'Mozilla',
              ipAddress: '127.0.0.2',
              lastActivityAt: new Date(),
              expiresAt: new Date(Date.now() + 36000),
              revokedAt: null,
              revokedReason: null,
              createdAt: new Date(),
            }),
          ]),
        ),
      } as unknown as IUserSessionRepository

      const useCase = new ListSessionsUseCase(userSessionRepository)

      // Ejecuta el caso de uso marcando "key-current" como la sesión activa actual del cliente
      const result = await useCase.execute('user-123', 'key-current')

      // Assertions
      expect(userSessionRepository.listActiveByUserId).toHaveBeenCalledWith(
        'user-123',
      )
      expect(result.sessions).toHaveLength(2)
      // La primera sesión debe marcarse con isCurrent: true ya que coincide con la clave actual
      expect(result.sessions[0]!.id).toBe('sess-1')
      expect(result.sessions[0]!.isCurrent).toBe(true)
      // La segunda sesión tiene una clave distinta y se marca con isCurrent: false
      expect(result.sessions[1]!.id).toBe('sess-2')
      expect(result.sessions[1]!.isCurrent).toBe(false)
    })
  })

  /**
   * Pruebas para RevokeSessionUseCase.
   * Valida la revocación individual de una sesión de usuario y el comportamiento cuando es la sesión actual.
   */
  describe('RevokeSessionUseCase', () => {
    const defaultSession = new UserSession({
      id: 'sess-1',
      userId: 'user-123',
      sessionKey: 'key-current',
      authzVersion: 1,
      deviceName: 'Device 1',
      deviceFingerprint: 'fp1',
      userAgent: 'Mozilla',
      ipAddress: '127.0.0.1',
      lastActivityAt: new Date(),
      expiresAt: new Date(Date.now() + 36000),
      revokedAt: null,
      revokedReason: null,
      createdAt: new Date(),
    })

    it('should revoke a valid session and blacklist access token if it is the current session', async () => {
      // Mock de TokenService que decodifica un token de acceso activo
      const decodeAccessToken = vi.fn(() => ({
        jti: 'access-jti-123',
        userId: 'user-123',
        sessionKey: 'key-current',
        exp: Math.floor(Date.now() / 1000) + 120, // TTL de 2 minutos
      }))

      const tokenService = { decodeAccessToken } as unknown as ITokenService

      // Mock de SessionStore (Redis) para verificar la eliminación de refresh token e invalidación inmediata del actual
      const sessionStore = {
        deleteRefreshToken: vi.fn(() => Promise.resolve()),
        blacklistAccessToken: vi.fn(() => Promise.resolve()),
      } as unknown as ISessionStore

      // Mocks del Unit of Work para base de datos
      const findById = vi.fn(() => Promise.resolve(defaultSession))
      const findLatestActiveBySessionId = vi.fn(() =>
        Promise.resolve(
          new RefreshToken({
            id: 'tok-123',
            jti: 'refresh-jti-123',
            userId: 'user-123',
            sessionId: 'sess-1',
            tokenHash: 'hash',
            expiresAt: new Date(),
            revokedAt: null,
            replacedByTokenId: null,
            revokedReason: null,
            lastUsedAt: null,
            createdAt: new Date(),
            userAgent: 'Mozilla',
            ipAddress: '127.0.0.1',
          }),
        ),
      )
      const revokeById = vi.fn(() => Promise.resolve())
      const revokeAllBySessionId = vi.fn(() => Promise.resolve())
      const recordEvent = vi.fn(() => Promise.resolve())
      const acquireUserMutationLock = vi.fn(() => Promise.resolve())

      const repositories = {
        userSessionRepository: { findById, revokeById },
        refreshTokenRepository: {
          findLatestActiveBySessionId,
          revokeAllBySessionId,
        },
        authAuditService: { recordEvent },
        acquireUserMutationLock,
      }

      const authUnitOfWork = {
        run: vi.fn(async (callback) => callback(repositories)),
      } as unknown as IAuthUnitOfWork

      const useCase = new RevokeSessionUseCase(
        tokenService,
        sessionStore,
        authUnitOfWork,
      )

      const result = await useCase.execute({
        sessionId: 'sess-1',
        userId: 'user-123',
        currentSessionKey: 'key-current',
        accessToken: 'valid-access-token',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla',
        requestId: 'req-123',
      })

      // Verificaciones:
      // 1. Busca la sesión e invoca la revocación en los repositorios de DB.
      expect(findById).toHaveBeenCalledWith('sess-1')
      expect(revokeById).toHaveBeenCalledWith(
        'sess-1',
        expect.any(Date),
        'session_revoked',
      )
      expect(revokeAllBySessionId).toHaveBeenCalledWith(
        'sess-1',
        expect.any(Date),
        'session_revoked',
      )
      // 2. Elimina el refresh token del almacén de Redis.
      expect(sessionStore.deleteRefreshToken).toHaveBeenCalledWith(
        'user-123',
        'refresh-jti-123',
      )
      // 3. Agrega a la lista negra el token de acceso actual en Redis ya que la sesión revocada coincide con la actual.
      expect(sessionStore.blacklistAccessToken).toHaveBeenCalledWith(
        'access-jti-123',
        expect.any(Number),
      )
      // 4. Retorna la bandera de que efectivamente fue la sesión actual la que se cerró (lo que disparará la limpieza de cookies).
      expect(result.isCurrentSession).toBe(true)
    })

    it('should throw NotFoundError if session not found or belongs to another user', async () => {
      const tokenService = {
        decodeAccessToken: vi.fn(),
      } as unknown as ITokenService
      const sessionStore = {
        deleteRefreshToken: vi.fn(),
        blacklistAccessToken: vi.fn(),
      } as unknown as ISessionStore

      // La sesión a buscar le pertenece a un usuario diferente (user-other)
      const findById = vi.fn(() =>
        Promise.resolve(
          new UserSession({
            ...defaultSession,
            userId: 'user-other',
          }),
        ),
      )
      const repositories = {
        userSessionRepository: { findById },
        refreshTokenRepository: { findLatestActiveBySessionId: vi.fn() },
        acquireUserMutationLock: vi.fn(),
      }
      const authUnitOfWork = {
        run: vi.fn(async (callback) => callback(repositories)),
      } as unknown as IAuthUnitOfWork

      const useCase = new RevokeSessionUseCase(
        tokenService,
        sessionStore,
        authUnitOfWork,
      )

      // Debe fallar con NotFoundError al intentar revocar una sesión ajena o inexistente
      await expect(
        useCase.execute({
          sessionId: 'sess-1',
          userId: 'user-123',
          currentSessionKey: 'key-current',
          accessToken: 'valid-access-token',
          ipAddress: '127.0.0.1',
          userAgent: 'Mozilla',
          requestId: 'req-123',
        }),
      ).rejects.toThrow(NotFoundError)
    })
  })

  /**
   * Pruebas para LogoutUseCase.
   * Valida la idempotencia y robustez (best-effort) ante el cierre de sesión de un cliente.
   */
  describe('LogoutUseCase', () => {
    it('should execute successfully without tokens (idempotent)', async () => {
      // Si el usuario invoca logout pero no envía tokens (ej. ya había cerrado sesión o las cookies no existen)
      const tokenService = {
        decodeAccessToken: vi.fn(() => null),
        verifyRefreshToken: vi.fn(),
      } as unknown as ITokenService
      const sessionStore = {
        blacklistAccessToken: vi.fn(),
        deleteRefreshToken: vi.fn(),
      } as unknown as ISessionStore
      const recordEvent = vi.fn()
      const acquireUserMutationLock = vi.fn()
      const repositories = {
        authAuditService: { recordEvent },
        acquireUserMutationLock,
      }
      const authUnitOfWork = {
        run: vi.fn(async (callback) => callback(repositories)),
      } as unknown as IAuthUnitOfWork

      const useCase = new LogoutUseCase(
        tokenService,
        sessionStore,
        authUnitOfWork,
      )

      // El cierre de sesión debe ser exitoso e idempotente
      await expect(
        useCase.execute({
          accessToken: null,
          refreshToken: null,
          userId: null,
          sessionKey: null,
          ipAddress: '127.0.0.1',
          userAgent: 'Mozilla',
          requestId: 'req-123',
        }),
      ).resolves.not.toThrow()

      // Debe registrar la auditoría de logout exitoso
      expect(recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'logout_success',
          eventStatus: 'success',
        }),
      )
    })

    it('should be best-effort if refresh token verification fails', async () => {
      // Si el token de actualización es inválido o expiró, el logout no debe arrojar error al usuario.
      // Debe proceder con el flujo (estrategia best-effort).
      const tokenService = {
        decodeAccessToken: vi.fn(() => null),
        verifyRefreshToken: vi.fn(() =>
          Promise.reject(new Error('Invalid token')),
        ),
      } as unknown as ITokenService
      const sessionStore = {
        blacklistAccessToken: vi.fn(),
        deleteRefreshToken: vi.fn(),
      } as unknown as ISessionStore
      const recordEvent = vi.fn()
      const acquireUserMutationLock = vi.fn()
      const repositories = {
        authAuditService: { recordEvent },
        acquireUserMutationLock,
        refreshTokenRepository: {
          findByJti: vi.fn(() => Promise.resolve(null)),
          revokeByJti: vi.fn(() => Promise.resolve()),
        },
        userSessionRepository: {
          findById: vi.fn(() => Promise.resolve(null)),
          revokeBySessionKey: vi.fn(() => Promise.resolve()),
        },
      }
      const authUnitOfWork = {
        run: vi.fn(async (callback) => callback(repositories)),
      } as unknown as IAuthUnitOfWork

      const useCase = new LogoutUseCase(
        tokenService,
        sessionStore,
        authUnitOfWork,
      )

      await expect(
        useCase.execute({
          accessToken: null,
          refreshToken: 'invalid-refresh-token',
          userId: 'user-123',
          sessionKey: 'key-123',
          ipAddress: '127.0.0.1',
          userAgent: 'Mozilla',
          requestId: 'req-123',
        }),
      ).resolves.not.toThrow()

      // Registra el evento de logout a nivel de auditoría
      expect(recordEvent).toHaveBeenCalled()
      expect(acquireUserMutationLock).toHaveBeenCalledWith('user-123')
    })
  })

  /**
   * Pruebas para LogoutAllUseCase.
   * Valida la revocación global de todas las sesiones de un usuario determinado.
   */
  describe('LogoutAllUseCase', () => {
    it('should revoke all user sessions and refresh tokens, blacklisting the current access token', async () => {
      const decodeAccessToken = vi.fn(() => ({
        jti: 'access-jti-123',
        userId: 'user-123',
        sessionKey: 'key-current',
        exp: Math.floor(Date.now() / 1000) + 120, // 2 minutos de TTL
      }))

      const tokenService = { decodeAccessToken } as unknown as ITokenService
      const sessionStore = {
        blacklistAccessToken: vi.fn(() => Promise.resolve()),
        deleteAllRefreshTokens: vi.fn(() => Promise.resolve()),
      } as unknown as ISessionStore

      // Revocaciones masivas en base de datos
      const revokeAllByUserId = vi.fn(() => Promise.resolve())
      const revokeAllByUserIdRefresh = vi.fn(() => Promise.resolve())
      const recordEvent = vi.fn(() => Promise.resolve())
      const acquireUserMutationLock = vi.fn(() => Promise.resolve())

      const repositories = {
        userSessionRepository: { revokeAllByUserId },
        refreshTokenRepository: { revokeAllByUserId: revokeAllByUserIdRefresh },
        authAuditService: { recordEvent },
        acquireUserMutationLock,
      }

      const authUnitOfWork = {
        run: vi.fn(async (callback) => callback(repositories)),
      } as unknown as IAuthUnitOfWork

      const useCase = new LogoutAllUseCase(
        tokenService,
        sessionStore,
        authUnitOfWork,
      )

      await useCase.execute({
        accessToken: 'valid-access-token',
        userId: 'user-123',
        sessionKey: 'key-current',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla',
        requestId: 'req-123',
      })

      // Valida bloqueo por concurrencia y revocación global en repositorios
      expect(acquireUserMutationLock).toHaveBeenCalledWith('user-123')
      expect(revokeAllByUserId).toHaveBeenCalledWith(
        'user-123',
        expect.any(Date),
        'logout_all',
      )
      expect(revokeAllByUserIdRefresh).toHaveBeenCalledWith({
        userId: 'user-123',
        revokedAt: expect.any(Date),
        revokedReason: 'logout_all',
      })
      // Lista negra del token de acceso y eliminación completa de refresh tokens del usuario en Redis
      expect(sessionStore.blacklistAccessToken).toHaveBeenCalledWith(
        'access-jti-123',
        expect.any(Number),
      )
      expect(sessionStore.deleteAllRefreshTokens).toHaveBeenCalledWith(
        'user-123',
      )
    })

    it('should throw UnauthorizedError if user is not resolved', async () => {
      const tokenService = {
        decodeAccessToken: vi.fn(() => null),
      } as unknown as ITokenService
      const sessionStore = {
        blacklistAccessToken: vi.fn(),
        deleteAllRefreshTokens: vi.fn(),
      } as unknown as ISessionStore
      const authUnitOfWork = {
        run: vi.fn(),
      } as unknown as IAuthUnitOfWork

      const useCase = new LogoutAllUseCase(
        tokenService,
        sessionStore,
        authUnitOfWork,
      )

      // Lanza error 401 si no hay usuario autenticado resuelto
      await expect(
        useCase.execute({
          accessToken: null,
          userId: null,
          sessionKey: null,
          ipAddress: '127.0.0.1',
          userAgent: 'Mozilla',
          requestId: 'req-123',
        }),
      ).rejects.toThrow(UnauthorizedError)
    })
  })
})
