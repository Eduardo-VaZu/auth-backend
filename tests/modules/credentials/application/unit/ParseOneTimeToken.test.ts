import { describe, expect, it } from 'vitest'
import { parseOneTimeToken } from '@/modules/credentials/application/utils/parseOneTimeToken.js'

describe('ParseOneTimeToken - Pruebas Unitarias', () => {
  it('parses a valid uuid.secret token', () => {
    // Caso 1: Acepta token con formato válido 'uuid.secret' y lo divide en tokenId y secret
    const token = '11111111-1111-4111-8111-111111111111.abcdef'
    const result = parseOneTimeToken(token)
    expect(result).toEqual({
      tokenId: '11111111-1111-4111-8111-111111111111',
      secret: 'abcdef',
    })
  })

  it('returns null for empty string', () => {
    // Caso 2: Rechaza strings vacíos retornando null
    expect(parseOneTimeToken('')).toBeNull()
  })

  it('returns null for string without dot separator', () => {
    // Caso 3: Rechaza tokens que no contienen el punto separador entre el uuid y el secreto
    expect(
      parseOneTimeToken('11111111-1111-4111-8111-111111111111abcdef'),
    ).toBeNull()
  })

  it('returns null for string with multiple dots', () => {
    // Caso 4: Rechaza tokens con múltiples puntos que invalidarían el formato simple de uuid.secret
    expect(
      parseOneTimeToken('11111111-1111-4111-8111-111111111111.abc.def'),
    ).toBeNull()
  })

  it('returns null for non-uuid prefix', () => {
    // Caso 5: Rechaza prefijos antes del punto que no sigan la estructura/regex de un UUIDv4
    expect(parseOneTimeToken('not-a-uuid.secret')).toBeNull()
  })

  it('returns null for empty secret after dot', () => {
    // Caso 6: Rechaza tokens donde el secreto después del punto esté vacío (ej. 'uuid.')
    expect(
      parseOneTimeToken('11111111-1111-4111-8111-111111111111.'),
    ).toBeNull()
  })
})
