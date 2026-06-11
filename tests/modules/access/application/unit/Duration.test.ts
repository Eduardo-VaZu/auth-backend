import { describe, it, expect } from 'vitest'
import { durationToSeconds } from '@/modules/access/application/utils/duration.js'
import { ValidationError } from '@/shared/errors/ValidationError.js'

describe('Duration Utility', () => {
    it('Debe convertir correctamente segundos (s), minutos (m), horas (h) y días (d) a ms', () => {
        expect(durationToSeconds('30s')).toBe(30)
        expect(durationToSeconds('5m')).toBe(300)
        expect(durationToSeconds('2h')).toBe(7200)
        expect(durationToSeconds('1d')).toBe(86400)
    })

    it('Debe rechazar formatos inválidos', () => {
        expect(() => durationToSeconds('invalid')).toThrow(ValidationError)
        expect(() => durationToSeconds('10x')).toThrow(ValidationError)
        expect(() => durationToSeconds('m5')).toThrow(ValidationError)
    })
})