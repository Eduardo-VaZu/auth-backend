import { describe, expect, it } from 'vitest'
import { Email } from '@/modules/identity/domain/value-objects/Email.js'
import { User } from '@/modules/identity/domain/entities/User.js'
import type {
  UserProps,
  UserRole,
} from '@/modules/identity/domain/entities/User.js'

describe('Identity Domain', () => {
  describe('Value Object: Email', () => {
    it('normalizes spaces and uppercase', () => {
      const email = new Email('  LINCOLM@Uto.Edu.Pe  ')
      const emailValue = (email as unknown as { value: string })['value']
      expect(emailValue).toBe('lincolm@uto.edu.pe')
    })

    it('accepts valid formats', () => {
      expect(() => new Email('user.name+tag@domain.co.uk')).not.toThrow()
      expect(() => new Email('simple@domain.com')).not.toThrow()
    })

    it('rejects invalid formats', () => {
      expect(() => new Email('correo-invalido')).toThrow()
      expect(() => new Email('sinarroba.com')).toThrow()
      expect(() => new Email('@sinlocal.com')).toThrow()
    })
  })

  describe('Entity: User', () => {
    const baseProps: UserProps = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'lincolm.test@example.com',
      status: 'active',
      authzVersion: 1,
      roles: [],
      emailVerifiedAt: null,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    }

    it('canAuthenticate is true only if status is active and not deleted', () => {
      const user = new User({ ...baseProps, status: 'active' })
      expect(user.canAuthenticate()).toBe(true)
    })

    it('canAuthenticate is false if user is deleted', () => {
      const user = new User({
        ...baseProps,
        status: 'active',
        deletedAt: new Date(),
      })
      expect(user.canAuthenticate()).toBe(false)
    })

    it('canAuthenticate is false in disabled, locked, or pending_verification status', () => {
      const disabledUser = new User({ ...baseProps, status: 'disabled' })
      expect(disabledUser.canAuthenticate()).toBe(false)

      const lockedUser = new User({ ...baseProps, status: 'locked' })
      expect(lockedUser.canAuthenticate()).toBe(false)

      const pendingUser = new User({
        ...baseProps,
        status: 'pending_verification',
      })
      expect(pendingUser.canAuthenticate()).toBe(false)
    })

    it('primaryRole returns the first role or fallback "user"', () => {
      const userWithRoles = new User({
        ...baseProps,
        roles: ['admin', 'user'] as UserRole[],
      })
      expect(userWithRoles.primaryRole()).toBe('admin')

      const userWithoutRoles = new User({ ...baseProps, roles: [] })
      expect(userWithoutRoles.primaryRole()).toBe('user')
    })
  })
})
