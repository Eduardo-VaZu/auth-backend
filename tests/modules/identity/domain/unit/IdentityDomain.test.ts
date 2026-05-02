import { describe, expect, it } from 'vitest'
import { Email } from '@/modules/identity/domain/value-objects/Email.js'
import { User } from '@/modules/identity/domain/entities/User.js'
import type { UserProps } from '@/modules/identity/domain/entities/User.js'

describe('Identity Domain', () => {
  it('Email: normalizes spaces and uppercase', () => {
    const email = new Email('  LINCOLM@Uto.Edu.Pe  ')
    // Acceso seguro para evitar error de propiedad privada en TS
    const emailValue = (email as unknown as { value: string })['value']
    expect(emailValue).toBe('lincolm@uto.edu.pe')
  })

  it('Email: throws error on invalid format', () => {
    expect(() => new Email('correo-invalido')).toThrow()
  })

  it('User: canAuthenticate is true only if status is active', () => {
    // Completamos todas las propiedades requeridas por UserProps según tu DB
    const userProps: UserProps = {
      id: '550e8400-e29b-41d4-a716-446655440000', // UUID de ejemplo
      email: 'lincolm.test@example.com',
      status: 'active',
      authzVersion: 1,
      roles: [], // Agregamos el array de roles que faltaba
      emailVerifiedAt: null, // Propiedad faltante según error
      lastLoginAt: null,    // Propiedad faltante según error
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    }

    const user = new User(userProps)
    expect(user.canAuthenticate()).toBe(true)
  })

  it('User: canAuthenticate is false if user is deleted', () => {
    const userProps: UserProps = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'lincolm.test@example.com',
      status: 'active',
      authzVersion: 1,
      roles: [],
      emailVerifiedAt: null,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: new Date() // Simula borrado lógico
    }

    const user = new User(userProps)
    expect(user.canAuthenticate()).toBe(false)
  })
})