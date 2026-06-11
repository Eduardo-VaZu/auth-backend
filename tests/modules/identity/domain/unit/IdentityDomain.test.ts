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

    it('accepts a valid email without throwing', () => {
      expect(() => new Email('user@example.com')).not.toThrow()
      const email = new Email('user@example.com') as unknown as {
        value: string
      }
      expect(email.value).toBe('user@example.com')
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

    it('canAuthenticate returns false when status is disabled', () => {
      const user = new User({ ...baseProps, status: 'disabled' })
      expect(user.canAuthenticate()).toBe(false)
    })

    it('canAuthenticate returns false when status is locked', () => {
      const user = new User({ ...baseProps, status: 'locked' })
      expect(user.canAuthenticate()).toBe(false)
    })

    it('canAuthenticate returns false when status is pending_verification', () => {
      const user = new User({ ...baseProps, status: 'pending_verification' })
      expect(user.canAuthenticate()).toBe(false)
    })

    it('primaryRole returns admin when roles include admin', () => {
      const user = new User({
        ...baseProps,
        roles: ['user', 'admin'] as UserRole[],
      })
      expect(user.primaryRole()).toBe('admin')
    })

    it('primaryRole returns first role when admin is not present', () => {
      const user = new User({
        ...baseProps,
        roles: ['editor', 'user'] as UserRole[],
      })
      expect(user.primaryRole()).toBe('editor')
    })

    it('primaryRole returns user when roles array is empty', () => {
      const user = new User({ ...baseProps, roles: [] })
      expect(user.primaryRole()).toBe('user')
    })
  })
})
