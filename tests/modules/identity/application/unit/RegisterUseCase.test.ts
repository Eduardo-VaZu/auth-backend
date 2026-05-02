import { describe, expect, it, vi } from 'vitest'

import type { AuthRepositories } from '@/shared/domain/services/IAuthUnitOfWork.js'
import { RegisterUseCase } from '@/modules/identity/application/use-cases/RegisterUseCase.js'
import type { IAuthUnitOfWork } from '@/shared/domain/services/IAuthUnitOfWork.js'
import { OneTimeToken } from '@/modules/credentials/domain/entities/OneTimeToken.js'
import type { IAuthEmailService } from '@/modules/credentials/domain/services/IAuthEmailService.js'
import { User } from '@/modules/identity/domain/entities/User.js'

describe('RegisterUseCase', () => {
  it('creates a pending verification user and dispatches a verification token', async () => {
    const createUser = vi.fn((params: { email: string; role?: string; status?: string }) =>
      Promise.resolve(
        new User({
          id: '11111111-1111-4111-8111-111111111111',
          email: params.email,
          roles: ['user'],
          status: 'pending_verification',
          authzVersion: 1,
          emailVerifiedAt: null,
          lastLoginAt: null,
          createdAt: new Date('2026-05-01T00:00:00.000Z'),
          updatedAt: new Date('2026-05-01T00:00:00.000Z'),
          deletedAt: null,
        }),
      ),
    )
    const createCredential = vi.fn(() => Promise.resolve({}))
    const invalidateActiveByUserId = vi.fn(() => Promise.resolve())
    const createOneTimeToken = vi.fn(() =>
      Promise.resolve(
        new OneTimeToken({
          id: '22222222-2222-4222-8222-222222222222',
          userId: '11111111-1111-4111-8111-111111111111',
          type: 'email_verification',
          tokenHash: 'hashed-token',
          requestedByIp: null,
          expiresAt: new Date('2026-05-02T00:00:00.000Z'),
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
      userCredentialRepository: {
        create: createCredential,
      },
      userRepository: {
        findByEmail: vi.fn(() => Promise.resolve(null)),
        create: createUser,
      },
    } as unknown as AuthRepositories

    const authUnitOfWork: IAuthUnitOfWork = {
      run: async (callback) => callback(repositories),
    }

    const authEmailService: IAuthEmailService = {
      sendVerificationEmail: vi.fn(() =>
        Promise.resolve({
          previewToken: '22222222-2222-4222-8222-222222222222.secret',
        }),
      ),
      sendPasswordResetEmail: vi.fn(),
    }

    const useCase = new RegisterUseCase(authUnitOfWork, authEmailService)

    const result = await useCase.execute({
      email: 'user@example.com',
      password: 'very-secure-password',
      requestId: '33333333-3333-4333-8333-333333333333',
    })

    expect(createUser).toHaveBeenCalledWith({
      email: 'user@example.com',
      role: 'user',
      status: 'pending_verification',
    })
    expect(createCredential).toHaveBeenCalledOnce()
    expect(invalidateActiveByUserId).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      'email_verification',
    )
    expect(authEmailService.sendVerificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'user@example.com',
        reason: 'register',
        requestId: '33333333-3333-4333-8333-333333333333',
        token: expect.stringMatching(
          /^22222222-2222-4222-8222-222222222222\./,
        ),
      }),
    )
    expect(result).toEqual({
      user: {
        id: '11111111-1111-4111-8111-111111111111',
        email: 'user@example.com',
        role: 'user',
        roles: ['user'],
      },
      verificationRequired: true,
      message: 'Verify your email before signing in',
      previewToken: '22222222-2222-4222-8222-222222222222.secret',
    })
  })
})
