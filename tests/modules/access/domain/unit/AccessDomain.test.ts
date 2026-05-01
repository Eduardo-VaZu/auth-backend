import { describe, expect, it } from 'vitest'

import { RefreshToken } from '@/modules/access/domain/entities/RefreshToken.js'
import { UserSession } from '@/modules/access/domain/entities/UserSession.js'

describe('RefreshToken', () => {
  const baseDates = {
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
    expiresAt: new Date('2026-04-02T00:00:00.000Z'),
  }

  it('is active only while not revoked and not expired', () => {
    const activeToken = new RefreshToken({
      id: 'token-1',
      jti: 'jti-1',
      userId: 'user-1',
      sessionId: 'session-1',
      tokenHash: 'hash',
      revokedAt: null,
      replacedByTokenId: null,
      revokedReason: null,
      lastUsedAt: null,
      userAgent: null,
      ipAddress: null,
      ...baseDates,
    })
    const revokedToken = new RefreshToken({
      id: 'token-2',
      jti: 'jti-2',
      userId: 'user-1',
      sessionId: 'session-1',
      tokenHash: 'hash',
      revokedAt: new Date('2026-04-01T12:00:00.000Z'),
      replacedByTokenId: null,
      revokedReason: 'manual',
      lastUsedAt: null,
      userAgent: null,
      ipAddress: null,
      ...baseDates,
    })

    expect(activeToken.isActive(new Date('2026-04-01T06:00:00.000Z'))).toBe(
      true,
    )
    expect(activeToken.isActive(new Date('2026-04-03T00:00:00.000Z'))).toBe(
      false,
    )
    expect(revokedToken.isActive(new Date('2026-04-01T06:00:00.000Z'))).toBe(
      false,
    )
  })

  it('detects reuse incidents from revocation or token replacement', () => {
    const rotatedToken = new RefreshToken({
      id: 'token-3',
      jti: 'jti-3',
      userId: 'user-1',
      sessionId: 'session-1',
      tokenHash: 'hash',
      revokedAt: null,
      replacedByTokenId: 'token-4',
      revokedReason: null,
      lastUsedAt: null,
      userAgent: null,
      ipAddress: null,
      ...baseDates,
    })
    const cleanToken = new RefreshToken({
      id: 'token-5',
      jti: 'jti-5',
      userId: 'user-1',
      sessionId: 'session-1',
      tokenHash: 'hash',
      revokedAt: null,
      replacedByTokenId: null,
      revokedReason: null,
      lastUsedAt: null,
      userAgent: null,
      ipAddress: null,
      ...baseDates,
    })

    expect(rotatedToken.indicatesReuseIncident()).toBe(true)
    expect(cleanToken.indicatesReuseIncident()).toBe(false)
  })
})

describe('UserSession', () => {
  const baseDates = {
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
    lastActivityAt: new Date('2026-04-01T00:15:00.000Z'),
    expiresAt: new Date('2026-04-02T00:00:00.000Z'),
  }

  it('is active only while not revoked and not expired', () => {
    const activeSession = new UserSession({
      id: 'session-1',
      userId: 'user-1',
      sessionKey: 'session-key',
      authzVersion: 1,
      deviceName: null,
      deviceFingerprint: null,
      userAgent: 'vitest',
      ipAddress: '127.0.0.1',
      revokedAt: null,
      revokedReason: null,
      ...baseDates,
    })
    const revokedSession = new UserSession({
      id: 'session-2',
      userId: 'user-1',
      sessionKey: 'session-key-2',
      authzVersion: 1,
      deviceName: null,
      deviceFingerprint: null,
      userAgent: 'vitest',
      ipAddress: '127.0.0.1',
      revokedAt: new Date('2026-04-01T00:30:00.000Z'),
      revokedReason: 'manual',
      ...baseDates,
    })

    expect(activeSession.isActive(new Date('2026-04-01T12:00:00.000Z'))).toBe(
      true,
    )
    expect(activeSession.isActive(new Date('2026-04-03T00:00:00.000Z'))).toBe(
      false,
    )
    expect(revokedSession.isActive(new Date('2026-04-01T12:00:00.000Z'))).toBe(
      false,
    )
  })
})
