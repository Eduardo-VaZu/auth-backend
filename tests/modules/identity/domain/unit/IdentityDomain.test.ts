import { describe, expect, it } from 'vitest'

import { User } from '@/modules/identity/domain/entities/User.js'
import { Email } from '@/modules/identity/domain/value-objects/Email.js'
import { ValidationError } from '@/shared/errors/ValidationError.js'

describe('Email', () => {
  it('normalizes valid email addresses', () => {
    const email = new Email('  USER@Example.COM ')

    expect(email.value).toBe('user@example.com')
  })

  it('rejects invalid email addresses', () => {
    expect(() => new Email('not-an-email')).toThrowError(ValidationError)
  })
})

describe('User', () => {
  const baseDates = {
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
    updatedAt: new Date('2026-04-01T00:00:00.000Z'),
  }

  it('can authenticate only when active and not deleted', () => {
    const activeUser = new User({
      id: 'user-1',
      email: 'user@example.com',
      roles: ['user'],
      status: 'active',
      authzVersion: 1,
      emailVerifiedAt: null,
      lastLoginAt: null,
      deletedAt: null,
      ...baseDates,
    })
    const disabledUser = new User({
      id: 'user-2',
      email: 'disabled@example.com',
      roles: ['user'],
      status: 'disabled',
      authzVersion: 1,
      emailVerifiedAt: null,
      lastLoginAt: null,
      deletedAt: null,
      ...baseDates,
    })
    const deletedUser = new User({
      id: 'user-3',
      email: 'deleted@example.com',
      roles: ['admin'],
      status: 'active',
      authzVersion: 1,
      emailVerifiedAt: null,
      lastLoginAt: null,
      deletedAt: new Date('2026-04-02T00:00:00.000Z'),
      ...baseDates,
    })

    expect(activeUser.canAuthenticate()).toBe(true)
    expect(disabledUser.canAuthenticate()).toBe(false)
    expect(deletedUser.canAuthenticate()).toBe(false)
  })

  it('returns first assigned role as primary role and falls back to user', () => {
    const adminUser = new User({
      id: 'user-4',
      email: 'admin@example.com',
      roles: ['admin', 'user'],
      status: 'active',
      authzVersion: 1,
      emailVerifiedAt: null,
      lastLoginAt: null,
      deletedAt: null,
      ...baseDates,
    })
    const rolelessUser = new User({
      id: 'user-5',
      email: 'roleless@example.com',
      roles: [],
      status: 'active',
      authzVersion: 1,
      emailVerifiedAt: null,
      lastLoginAt: null,
      deletedAt: null,
      ...baseDates,
    })

    expect(adminUser.primaryRole()).toBe('admin')
    expect(rolelessUser.primaryRole()).toBe('user')
  })
})
