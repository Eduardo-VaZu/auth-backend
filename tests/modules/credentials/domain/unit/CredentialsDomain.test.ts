import { describe, expect, it } from 'vitest'
import { Password } from '@/modules/credentials/domain/value-objects/Password.js'
import { ValidationError } from '@/shared/errors/ValidationError.js'
import { OneTimeToken } from '@/modules/credentials/domain/entities/OneTimeToken.js'
import { UserCredential } from '@/modules/credentials/domain/entities/UserCredential.js'

describe('Credentials Domain - Pruebas Unitarias', () => {
  // Pruebas unitarias para el Value Object Password
  describe('Password (Objeto de Valor)', () => {
    it('Password accepts strings with 8 or more characters', () => {
      // Caso 1: Verifica que una contraseña válida (>= 8 caracteres) se crea sin lanzar excepciones
      const validPassword = new Password('12345678')
      expect(validPassword.value).toBe('12345678')
    })

    it('Password rejects strings shorter than 8 characters', () => {
      // Caso 2: Asegura que una contraseña muy corta lanza un error de validación (ValidationError)
      expect(() => new Password('1234567')).toThrow(ValidationError)
    })
  })

  // Pruebas unitarias para la entidad OneTimeToken
  describe('OneTimeToken (Entidad)', () => {
    it('OneTimeToken maps all properties from constructor', () => {
      // Caso 3: Verifica que la entidad mapea de manera correcta todas las propiedades recibidas en su constructor
      const props = {
        id: '11111111-1111-4111-8111-111111111111',
        userId: '22222222-2222-4222-8222-222222222222',
        type: 'password_reset' as const,
        tokenHash: 'hashed_token_value',
        requestedByIp: '127.0.0.1',
        expiresAt: new Date('2026-06-11T00:00:00.000Z'),
        usedAt: null,
        createdAt: new Date('2026-06-10T00:00:00.000Z'),
      }

      const token = new OneTimeToken(props)

      expect(token.id).toBe(props.id)
      expect(token.userId).toBe(props.userId)
      expect(token.type).toBe(props.type)
      expect(token.tokenHash).toBe(props.tokenHash)
      expect(token.requestedByIp).toBe(props.requestedByIp)
      expect(token.expiresAt).toBe(props.expiresAt)
      expect(token.usedAt).toBe(props.usedAt)
      expect(token.createdAt).toBe(props.createdAt)
    })
  })

  // Pruebas unitarias para la entidad UserCredential
  describe('UserCredential (Entidad)', () => {
    it('UserCredential maps all properties from constructor', () => {
      // Caso 4: Verifica que las credenciales de usuario mapean todas sus propiedades correctamente desde las opciones del constructor
      const props = {
        id: '33333333-3333-4333-8333-333333333333',
        userId: '44444444-4444-4444-8444-444444444444',
        passwordHash: 'hashed_password_value',
        passwordChangedAt: new Date('2026-06-10T12:00:00.000Z'),
        passwordVersion: 1,
        mustChangePassword: false,
        createdAt: new Date('2026-06-10T00:00:00.000Z'),
        updatedAt: new Date('2026-06-10T12:00:00.000Z'),
      }

      const credential = new UserCredential(props)

      expect(credential.id).toBe(props.id)
      expect(credential.userId).toBe(props.userId)
      expect(credential.passwordHash).toBe(props.passwordHash)
      expect(credential.passwordChangedAt).toBe(props.passwordChangedAt)
      expect(credential.passwordVersion).toBe(props.passwordVersion)
      expect(credential.mustChangePassword).toBe(props.mustChangePassword)
      expect(credential.createdAt).toBe(props.createdAt)
      expect(credential.updatedAt).toBe(props.updatedAt)
    })
  })
})
