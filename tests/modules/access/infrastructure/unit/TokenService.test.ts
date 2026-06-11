import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TokenService } from '@/modules/access/infrastructure/services/TokenService.js'
import { UnauthorizedError } from '@/shared/errors/HttpErrors.js'

vi.mock('@/config/env.js', () => ({
    env: {
        ACCESS_TOKEN_SECRET: 'secret-access-very-safe',
        REFRESH_TOKEN_SECRET: 'secret-refresh-very-safe',
        ACCESS_TOKEN_EXPIRES_IN: '1h',
        REFRESH_TOKEN_EXPIRES_IN: '7d',
    }
}))

describe('TokenService', () => {
    let tokenService: TokenService

    beforeEach(() => {
        tokenService = new TokenService()
    })

    it('Firma y verifica un access token correctamente', async () => {
        const payload = {
            userId: 'user-123',
            roles: ['user' as const],
            authzVersion: 1,
            sessionKey: 'session-key-123'
        }

        const { token } = await tokenService.generateAccessToken(payload)
        expect(token).toBeDefined()

        const verified = await tokenService.verifyAccessToken(token)
        expect(verified.userId).toBe(payload.userId)
        expect(verified.sessionKey).toBe(payload.sessionKey)
    })

    it('Firma y verifica un refresh token correctamente', async () => {
        const payload = { userId: 'user-123' }

        const { token } = await tokenService.generateRefreshToken(payload)
        expect(token).toBeDefined()

        const verified = await tokenService.verifyRefreshToken(token)
        expect(verified.userId).toBe(payload.userId)
    })

    it('Rechaza tokens y payloads inválidos', async () => {
        await expect(tokenService.verifyAccessToken('token-falso')).rejects.toThrow(UnauthorizedError)
    })

    it('decodeAccessToken retorna null cuando el token es inválido o el payload es incorrecto', async () => {
        const decoded = tokenService.decodeAccessToken('token-totalmente-invalido')
        expect(decoded).toBeNull()
    })
})