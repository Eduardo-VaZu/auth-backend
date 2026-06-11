import { describe, expect, it } from 'vitest'
import { RefreshToken } from '@/modules/access/domain/entities/RefreshToken.js'
import { UserSession } from '@/modules/access/domain/entities/UserSession.js'

/**
 * Pruebas unitarias para las entidades de dominio del módulo de acceso (Access).
 * Valida el comportamiento de las clases de dominio RefreshToken y UserSession
 * con respecto a sus estados de activación, expiración y control de reuso de tokens.
 */
describe('AccessDomain Entities', () => {
  /**
   * Pruebas para la entidad RefreshToken.
   * Verifica el estado activo del token y si indica un incidente de seguridad (reuso).
   */
  describe('RefreshToken', () => {
    const defaultProps = {
      id: 'token-id-123',
      jti: 'jti-123',
      userId: 'user-123',
      sessionId: 'session-123',
      tokenHash: 'hash',
      expiresAt: new Date(Date.now() + 3600 * 1000), // Expira en 1 hora (futuro)
      revokedAt: null,
      replacedByTokenId: null,
      revokedReason: null,
      lastUsedAt: null,
      createdAt: new Date(),
      userAgent: 'Mozilla',
      ipAddress: '127.0.0.1',
    }

    it('isActive should return true when not revoked and not expired', () => {
      // Un token activo es aquel que no ha sido revocado y su fecha de expiración es futura.
      const token = new RefreshToken(defaultProps)
      expect(token.isActive()).toBe(true)
    })

    it('isActive should return false when revoked', () => {
      // Si el token tiene una fecha de revocación establecida, no debe considerarse activo.
      const token = new RefreshToken({
        ...defaultProps,
        revokedAt: new Date(),
        revokedReason: 'logout',
      })
      expect(token.isActive()).toBe(false)
    })

    it('isActive should return false when expired', () => {
      // Si la fecha actual sobrepasa la fecha de expiración, el token no está activo.
      const token = new RefreshToken({
        ...defaultProps,
        expiresAt: new Date(Date.now() - 1000), // Expiró hace 1 segundo
      })
      expect(token.isActive()).toBe(false)
    })

    it('indicatesReuseIncident should return false when neither revoked nor replaced', () => {
      // Un token limpio y activo no indica ningún incidente de reuso de token.
      const token = new RefreshToken(defaultProps)
      expect(token.indicatesReuseIncident()).toBe(false)
    })

    it('indicatesReuseIncident should return true when revoked', () => {
      // Si el token ha sido revocado directamente, se marca como sospechoso o indicador de incidente si se vuelve a usar.
      const token = new RefreshToken({
        ...defaultProps,
        revokedAt: new Date(),
      })
      expect(token.indicatesReuseIncident()).toBe(true)
    })

    it('indicatesReuseIncident should return true when replaced by another token', () => {
      // Si el token ya fue rotado (reemplazado por otro ID de token), cualquier uso posterior de este token viejo representa un incidente de reuso.
      const token = new RefreshToken({
        ...defaultProps,
        replacedByTokenId: 'new-token-id',
      })
      expect(token.indicatesReuseIncident()).toBe(true)
    })
  })

  /**
   * Pruebas para la entidad UserSession.
   * Valida la lógica de ciclo de vida de la sesión activa del usuario.
   */
  describe('UserSession', () => {
    const defaultProps = {
      id: 'session-id-123',
      userId: 'user-123',
      sessionKey: 'session-key-123',
      authzVersion: 1,
      deviceName: 'My Device',
      deviceFingerprint: 'fingerprint-123',
      userAgent: 'Mozilla',
      ipAddress: '127.0.0.1',
      lastActivityAt: new Date(),
      expiresAt: new Date(Date.now() + 3600 * 1000), // Expira en 1 hora
      revokedAt: null,
      revokedReason: null,
      createdAt: new Date(),
    }

    it('isActive should return true when not revoked and not expired', () => {
      // Una sesión activa no está revocada y expira en el futuro.
      const session = new UserSession(defaultProps)
      expect(session.isActive()).toBe(true)
    })

    it('isActive should return false when revoked', () => {
      // Una sesión revocada explícitamente ya no está activa.
      const session = new UserSession({
        ...defaultProps,
        revokedAt: new Date(),
        revokedReason: 'logout',
      })
      expect(session.isActive()).toBe(false)
    })

    it('isActive should return false when expired', () => {
      // Una sesión cuya fecha de expiración quedó en el pasado ya no está activa.
      const session = new UserSession({
        ...defaultProps,
        expiresAt: new Date(Date.now() - 1000),
      })
      expect(session.isActive()).toBe(false)
    })
  })
})
