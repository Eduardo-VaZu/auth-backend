import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Logger } from 'pino'
import { UserSessionRepository } from '@/modules/access/infrastructure/repositories/UserSessionRepository.js'
import { RefreshTokenRepository } from '@/modules/access/infrastructure/repositories/RefreshTokenRepository.js'
import { UserSession } from '@/modules/access/domain/entities/UserSession.js'
import { RefreshToken } from '@/modules/access/domain/entities/RefreshToken.js'
import type { DatabaseExecutorSource } from '@/infrastructure/db/db.js'

/**
 * Clase auxiliar MockDb.
 * Emula la interfaz fluida del cliente de base de datos Drizzle ORM.
 * Devuelve `this` en cada eslabón de la cadena de consulta y es
 * Thenable para simular la resolución asíncrona de promesas (await).
 */
class MockDb {
  public resolveValue: unknown = []

  public select = vi.fn(() => this)
  public from = vi.fn(() => this)
  public where = vi.fn(() => this)
  public orderBy = vi.fn(() => this)
  public limit = vi.fn(() => this)
  public insert = vi.fn(() => this)
  public values = vi.fn(() => this)
  public update = vi.fn(() => this)
  public set = vi.fn(() => this)
  public delete = vi.fn(() => this)
  public returning = vi.fn(() => this)

  public then(onfulfilled?: (value: unknown) => unknown) {
    const res = Promise.resolve(this.resolveValue)
    return onfulfilled ? res.then(onfulfilled) : res
  }
}

/**
 * Pruebas unitarias para la capa de infraestructura/repositorios de sesiones.
 * Valida la correcta construcción de consultas SQL usando Drizzle y la conversión a entidades del dominio.
 */
describe('SessionRepositories Unit Tests', () => {
  let mockDb: MockDb
  let logger: Logger

  beforeEach(() => {
    mockDb = new MockDb()
    logger = {
      warn: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
    } as unknown as Logger
  })

  /**
   * Pruebas del repositorio UserSessionRepository.
   */
  describe('UserSessionRepository', () => {
    const validUuid = '11111111-1111-4111-8111-111111111111'
    const sessionRow = {
      id: validUuid,
      userId: validUuid,
      sessionKey: validUuid,
      authzVersion: 1,
      deviceName: 'Device',
      deviceFingerprint: 'fp',
      userAgent: 'Mozilla',
      ipAddress: '127.0.0.1',
      lastActivityAt: new Date(),
      expiresAt: new Date(),
      revokedAt: null,
      revokedReason: null,
      createdAt: new Date(),
    }

    it('should create and return a UserSession entity', async () => {
      mockDb.resolveValue = [sessionRow]
      const repo = new UserSessionRepository(
        mockDb as unknown as DatabaseExecutorSource,
        logger,
      )

      const result = await repo.create({
        userId: validUuid,
        sessionKey: validUuid,
        authzVersion: 1,
        deviceName: 'Device',
        deviceFingerprint: 'fp',
        userAgent: 'Mozilla',
        ipAddress: '127.0.0.1',
        expiresAt: new Date(),
      })

      // Verifica inserción y mapeo a entidad del dominio
      expect(mockDb.insert).toHaveBeenCalled()
      expect(mockDb.values).toHaveBeenCalled()
      expect(result).toBeInstanceOf(UserSession)
      expect(result.id).toBe(validUuid)
    })

    it('should find active sessions by user id', async () => {
      mockDb.resolveValue = [sessionRow]
      const repo = new UserSessionRepository(
        mockDb as unknown as DatabaseExecutorSource,
        logger,
      )

      const results = await repo.listActiveByUserId(validUuid)

      // Verifica filtrado de sesiones activas (no expiradas y no revocadas)
      expect(mockDb.select).toHaveBeenCalled()
      expect(mockDb.from).toHaveBeenCalled()
      expect(mockDb.where).toHaveBeenCalled()
      expect(results).toHaveLength(1)
      expect(results[0]!).toBeInstanceOf(UserSession)
    })

    it('should discard invalid UUIDs on select/find early', async () => {
      const repo = new UserSessionRepository(
        mockDb as unknown as DatabaseExecutorSource,
        logger,
      )

      // UUIDs inválidos deben retornar null o arreglos vacíos de forma temprana sin consultar base de datos
      const result1 = await repo.findById('invalid-uuid')
      const result2 = await repo.findBySessionKey('invalid-uuid')
      const result3 = await repo.listActiveByUserId('invalid-uuid')

      expect(result1).toBeNull()
      expect(result2).toBeNull()
      expect(result3).toEqual([])
      expect(mockDb.select).not.toHaveBeenCalled()
    })

    it('should revoke sessions by sessionKey, id, or userId', async () => {
      const repo = new UserSessionRepository(
        mockDb as unknown as DatabaseExecutorSource,
        logger,
      )

      // Revocar por sessionKey
      await repo.revokeBySessionKey(validUuid)
      expect(mockDb.update).toHaveBeenCalled()
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({ revokedAt: expect.any(Date) }),
      )

      // Revocar por id
      await repo.revokeById(validUuid)
      expect(mockDb.update).toHaveBeenCalledTimes(2)

      // Revocar todas por userId
      await repo.revokeAllByUserId(validUuid)
      expect(mockDb.update).toHaveBeenCalledTimes(3)
    })

    it('should delete expired sessions and return count', async () => {
      mockDb.resolveValue = [{ id: '1' }, { id: '2' }]
      const repo = new UserSessionRepository(
        mockDb as unknown as DatabaseExecutorSource,
        logger,
      )

      const deletedCount = await repo.deleteExpired(new Date())

      // Verifica eliminación de registros expirados
      expect(mockDb.delete).toHaveBeenCalled()
      expect(mockDb.where).toHaveBeenCalled()
      expect(deletedCount).toBe(2)
    })
  })

  /**
   * Pruebas del repositorio RefreshTokenRepository.
   */
  describe('RefreshTokenRepository', () => {
    const validUuid = '11111111-1111-4111-8111-111111111111'
    const tokenRow = {
      id: validUuid,
      jti: validUuid,
      userId: validUuid,
      sessionId: validUuid,
      tokenHash: 'hash',
      expiresAt: new Date(),
      revokedAt: null,
      replacedByTokenId: null,
      revokedReason: null,
      lastUsedAt: null,
      createdAt: new Date(),
      userAgent: 'Mozilla',
      ipAddress: '127.0.0.1',
    }

    it('should create and return a RefreshToken entity', async () => {
      mockDb.resolveValue = [tokenRow]
      const repo = new RefreshTokenRepository(
        mockDb as unknown as DatabaseExecutorSource,
        logger,
      )

      const result = await repo.create({
        jti: validUuid,
        userId: validUuid,
        sessionId: validUuid,
        tokenHash: 'hash',
        expiresAt: new Date(),
        userAgent: 'Mozilla',
        ipAddress: '127.0.0.1',
      })

      expect(mockDb.insert).toHaveBeenCalled()
      expect(mockDb.values).toHaveBeenCalled()
      expect(result).toBeInstanceOf(RefreshToken)
      expect(result.jti).toBe(validUuid)
    })

    it('should find token by jti', async () => {
      mockDb.resolveValue = [tokenRow]
      const repo = new RefreshTokenRepository(
        mockDb as unknown as DatabaseExecutorSource,
        logger,
      )

      const result = await repo.findByJti(validUuid)

      expect(mockDb.select).toHaveBeenCalled()
      expect(mockDb.where).toHaveBeenCalled()
      expect(result).toBeInstanceOf(RefreshToken)
      expect(result?.jti).toBe(validUuid)
    })

    it('should handle revoke active refresh token by jti', async () => {
      mockDb.resolveValue = [tokenRow]
      const repo = new RefreshTokenRepository(
        mockDb as unknown as DatabaseExecutorSource,
        logger,
      )

      const result = await repo.revokeActiveByJti({
        jti: validUuid,
        revokedAt: new Date(),
        revokedReason: 'reuse',
        replacedByTokenId: 'new-id',
        lastUsedAt: new Date(),
        referenceDate: new Date(),
      })

      // Verifica actualización en base de datos del token marcado
      expect(mockDb.update).toHaveBeenCalled()
      expect(mockDb.set).toHaveBeenCalled()
      expect(result).toBeInstanceOf(RefreshToken)
    })

    it('should count active sessions for user', async () => {
      mockDb.resolveValue = [{ count: 3 }]
      const repo = new RefreshTokenRepository(
        mockDb as unknown as DatabaseExecutorSource,
        logger,
      )

      const count = await repo.countActiveSessions(validUuid)

      expect(mockDb.select).toHaveBeenCalled()
      expect(count).toBe(3)
    })

    it('should delete expired tokens and return count', async () => {
      mockDb.resolveValue = [{ id: '1' }]
      const repo = new RefreshTokenRepository(
        mockDb as unknown as DatabaseExecutorSource,
        logger,
      )

      const deletedCount = await repo.deleteExpired(new Date())

      expect(mockDb.delete).toHaveBeenCalled()
      expect(deletedCount).toBe(1)
    })
  })
})
