import { describe, expect, it, vi } from 'vitest'

import type {
  AuthRepositories,
  IAuthUnitOfWork,
} from '@/shared/domain/services/IAuthUnitOfWork.js'
import { ForgotPasswordUseCase } from '@/modules/credentials/application/use-cases/ForgotPasswordUseCase.js'
import type { IAuthEmailService } from '@/modules/credentials/domain/services/IAuthEmailService.js'
import type { IUserRepository } from '@/modules/identity/domain/repositories/IUserRepository.js'
import { User } from '@/modules/identity/domain/entities/User.js'
import { OneTimeToken } from '@/modules/credentials/domain/entities/OneTimeToken.js'

describe('ForgotPasswordUseCase', () => {
  it('returns a preview token for an existing account and invalidates prior reset tokens', async () => {
    const existingUser = new User({
      id: '44444444-4444-4444-8444-444444444444',
      email: 'reset@example.com',
      roles: ['user'],
      status: 'active',
      authzVersion: 1,
      emailVerifiedAt: new Date('2026-05-01T00:00:00.000Z'),
      lastLoginAt: null,
      createdAt: new Date('2026-05-01T00:00:00.000Z'),
      updatedAt: new Date('2026-05-01T00:00:00.000Z'),
      deletedAt: null,
    })
    const invalidateActiveByUserId = vi.fn(() => Promise.resolve())
    const createOneTimeToken = vi.fn(() =>
      Promise.resolve(
        new OneTimeToken({
          id: '55555555-5555-4555-8555-555555555555',
          userId: existingUser.id,
          type: 'password_reset',
          tokenHash: 'hashed-token',
          requestedByIp: '127.0.0.1',
          expiresAt: new Date('2026-05-01T01:00:00.000Z'),
          usedAt: null,
          createdAt: new Date('2026-05-01T00:00:00.000Z'),
        }),
      ),
    )

    const repositories = {
      oneTimeTokenRepository: {
        invalidateActiveByUserId,
        create: createOneTimeToken,
      },
      authAuditService: {
        recordEvent: vi.fn(() => Promise.resolve()),
      },
    } as unknown as AuthRepositories

    const authUnitOfWork: IAuthUnitOfWork = {
      run: async (callback) => callback(repositories),
    }

    const authEmailService: IAuthEmailService = {
      sendPasswordResetEmail: vi.fn(() =>
        Promise.resolve({
          previewToken: '55555555-5555-4555-8555-555555555555.secret',
        }),
      ),
      sendVerificationEmail: vi.fn(),
    }

    const userRepository = {
      findByEmail: vi.fn(() => Promise.resolve(existingUser)),
    } as unknown as IUserRepository

    const useCase = new ForgotPasswordUseCase(
      userRepository,
      authUnitOfWork,
      authEmailService,
    )

    const result = await useCase.execute({
      email: existingUser.email,
      requestId: '66666666-6666-4666-8666-666666666666',
      userAgent: 'Vitest',
      ipAddress: '127.0.0.1',
    })

    expect(invalidateActiveByUserId).toHaveBeenCalledWith(
      existingUser.id,
      'password_reset',
    )
    expect(authEmailService.sendPasswordResetEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: existingUser.email,
        requestId: '66666666-6666-4666-8666-666666666666',
        token: expect.stringMatching(/^55555555-5555-4555-8555-555555555555\./),
      }),
    )
    expect(result).toEqual({
      previewToken: '55555555-5555-4555-8555-555555555555.secret',
    })
  })
})
