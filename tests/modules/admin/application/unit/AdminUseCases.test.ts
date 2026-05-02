import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AssignUserRoleUseCase } from '@/modules/admin/application/use-cases/AssignUserRoleUseCase.js'
import { GetUserProfileUseCase } from '@/modules/admin/application/use-cases/GetUserProfileUseCase.js'
import { ListRolesUseCase } from '@/modules/admin/application/use-cases/ListRolesUseCase.js'
import { ListUserRolesUseCase } from '@/modules/admin/application/use-cases/ListUserRolesUseCase.js'
import { ListUsersUseCase } from '@/modules/admin/application/use-cases/ListUsersUseCase.js'
import { RevokeUserRoleUseCase } from '@/modules/admin/application/use-cases/RevokeUserRoleUseCase.js'
import { SoftDeleteUserUseCase } from '@/modules/admin/application/use-cases/SoftDeleteUserUseCase.js'
import { UpdateUserStatusUseCase } from '@/modules/admin/application/use-cases/UpdateUserStatusUseCase.js'
import { Role } from '@/modules/admin/domain/entities/Role.js'
import { User } from '@/modules/identity/domain/entities/User.js'
import type { IAuthUnitOfWork } from '@/shared/domain/services/IAuthUnitOfWork.js'
import { ConflictError, NotFoundError } from '@/shared/errors/HttpErrors.js'

const NOW = new Date('2026-05-02T12:00:00.000Z')

const createUser = (overrides: Partial<User> = {}): User =>
  new User({
    id: '11111111-1111-4111-8111-111111111111',
    email: 'target@example.com',
    roles: ['user'],
    status: 'active',
    authzVersion: 1,
    emailVerifiedAt: new Date('2026-05-01T00:00:00.000Z'),
    lastLoginAt: null,
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  })

const createRole = (overrides: Partial<Role> = {}): Role =>
  new Role({
    id: '22222222-2222-4222-8222-222222222222',
    code: 'admin',
    name: 'Administrator',
    description: 'Full administrative access',
    isSystem: true,
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    ...overrides,
  })

const createAuthContext = () => {
  const tokenService = {
    decodeAccessToken: vi.fn(() => ({
      userId: '11111111-1111-4111-8111-111111111111',
      role: 'user',
      roles: ['user'],
      authzVersion: 1,
      jti: '33333333-3333-4333-8333-333333333333',
      sessionKey: '44444444-4444-4444-8444-444444444444',
      exp: Math.floor(NOW.getTime() / 1000) + 300,
    })),
  }
  const sessionStore = {
    deleteAllRefreshTokens: vi.fn(() => Promise.resolve()),
    blacklistAccessToken: vi.fn(() => Promise.resolve()),
  }
  const userRepository = {
    findById: vi.fn(),
    listPaginated: vi.fn(),
    updateStatus: vi.fn(() => Promise.resolve(null)),
    softDelete: vi.fn(() => Promise.resolve(null)),
  }
  const roleRepository = {
    findById: vi.fn(),
    listAll: vi.fn(),
  }
  const userRoleRepository = {
    assignActiveRole: vi.fn(),
    listActiveByUserId: vi.fn(),
    revokeActiveRole: vi.fn(),
  }
  const userSessionRepository = {
    revokeAllByUserId: vi.fn(() => Promise.resolve()),
  }
  const refreshTokenRepository = {
    revokeAllByUserId: vi.fn(() => Promise.resolve()),
  }
  const authAuditService = {
    recordEvent: vi.fn(() => Promise.resolve()),
  }
  const acquireUserMutationLock = vi.fn(() => Promise.resolve())

  const authUnitOfWork: IAuthUnitOfWork = {
    run: async (callback) =>
      callback({
        authAuditService,
        refreshTokenRepository,
        roleRepository,
        userRepository,
        userRoleRepository,
        userSessionRepository,
        acquireUserMutationLock,
      } as never),
  }

  return {
    tokenService,
    sessionStore,
    authUnitOfWork,
    userRepository,
    roleRepository,
    userRoleRepository,
    userSessionRepository,
    refreshTokenRepository,
    authAuditService,
    acquireUserMutationLock,
  }
}

describe('Admin use cases', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  it('assigns role and revokes target sessions/tokens', async () => {
    const ctx = createAuthContext()
    const targetUser = createUser()
    const targetRole = createRole()
    ctx.userRepository.findById.mockResolvedValue(targetUser)
    ctx.roleRepository.findById.mockResolvedValue(targetRole)
    ctx.userRoleRepository.assignActiveRole.mockResolvedValue(true)

    const useCase = new AssignUserRoleUseCase(
      ctx.tokenService as never,
      ctx.sessionStore as never,
      ctx.authUnitOfWork,
    )

    const result = await useCase.execute({
      actorUserId: '55555555-5555-4555-8555-555555555555',
      targetUserId: targetUser.id,
      roleId: targetRole.id,
      accessToken: 'access-token',
      requestId: '66666666-6666-4666-8666-666666666666',
      userAgent: 'Vitest',
      ipAddress: '127.0.0.1',
    })

    expect(ctx.acquireUserMutationLock).toHaveBeenCalledWith(targetUser.id)
    expect(ctx.userRoleRepository.assignActiveRole).toHaveBeenCalledWith({
      userId: targetUser.id,
      roleId: targetRole.id,
      assignedByUserId: '55555555-5555-4555-8555-555555555555',
    })
    expect(ctx.userSessionRepository.revokeAllByUserId).toHaveBeenCalledWith(
      targetUser.id,
      NOW,
      'role_changed',
    )
    expect(ctx.refreshTokenRepository.revokeAllByUserId).toHaveBeenCalledWith({
      userId: targetUser.id,
      revokedAt: NOW,
      revokedReason: 'role_changed',
    })
    expect(ctx.sessionStore.deleteAllRefreshTokens).toHaveBeenCalledWith(
      targetUser.id,
    )
    expect(ctx.sessionStore.blacklistAccessToken).toHaveBeenCalledWith(
      '33333333-3333-4333-8333-333333333333',
      300,
    )
    expect(result).toEqual({
      clearAuthCookies: true,
    })
  })

  it('rejects duplicate role assignment', async () => {
    const ctx = createAuthContext()
    ctx.userRepository.findById.mockResolvedValue(createUser())
    ctx.roleRepository.findById.mockResolvedValue(createRole())
    ctx.userRoleRepository.assignActiveRole.mockResolvedValue(false)

    const useCase = new AssignUserRoleUseCase(
      ctx.tokenService as never,
      ctx.sessionStore as never,
      ctx.authUnitOfWork,
    )

    await expect(
      useCase.execute({
        actorUserId: '55555555-5555-4555-8555-555555555555',
        targetUserId: '11111111-1111-4111-8111-111111111111',
        roleId: '22222222-2222-4222-8222-222222222222',
        accessToken: null,
        requestId: null,
        userAgent: null,
        ipAddress: null,
      }),
    ).rejects.toThrow(ConflictError)
  })

  it('revokes role and blocks removing last active role', async () => {
    const ctx = createAuthContext()
    const user = createUser()
    const adminRole = createRole()
    const userRole = createRole({
      id: '77777777-7777-4777-8777-777777777777',
      code: 'user',
      name: 'User',
      description: 'Standard access',
    })
    ctx.userRepository.findById.mockResolvedValue(user)
    ctx.roleRepository.findById.mockResolvedValue(adminRole)
    ctx.userRoleRepository.listActiveByUserId.mockResolvedValue([
      adminRole,
      userRole,
    ])
    ctx.userRoleRepository.revokeActiveRole.mockResolvedValue(true)

    const useCase = new RevokeUserRoleUseCase(
      ctx.tokenService as never,
      ctx.sessionStore as never,
      ctx.authUnitOfWork,
    )

    await expect(
      useCase.execute({
        actorUserId: '55555555-5555-4555-8555-555555555555',
        targetUserId: user.id,
        roleId: adminRole.id,
        accessToken: null,
        requestId: null,
        userAgent: null,
        ipAddress: null,
      }),
    ).resolves.toEqual({
      clearAuthCookies: false,
    })

    ctx.userRoleRepository.listActiveByUserId.mockResolvedValue([adminRole])

    await expect(
      useCase.execute({
        actorUserId: '55555555-5555-4555-8555-555555555555',
        targetUserId: user.id,
        roleId: adminRole.id,
        accessToken: null,
        requestId: null,
        userAgent: null,
        ipAddress: null,
      }),
    ).rejects.toThrow(ConflictError)
  })

  it('updates status and revokes auth artifacts only when status changes', async () => {
    const ctx = createAuthContext()
    const activeUser = createUser({
      id: '88888888-8888-4888-8888-888888888888',
      status: 'active',
    })
    ctx.userRepository.findById.mockResolvedValue(activeUser)

    const useCase = new UpdateUserStatusUseCase(
      ctx.tokenService as never,
      ctx.sessionStore as never,
      ctx.authUnitOfWork,
    )

    const changedResult = await useCase.execute({
      actorUserId: '55555555-5555-4555-8555-555555555555',
      targetUserId: activeUser.id,
      status: 'disabled',
      accessToken: 'access-token',
      requestId: null,
      userAgent: null,
      ipAddress: null,
    })

    expect(changedResult).toEqual({
      clearAuthCookies: false,
    })
    expect(ctx.userRepository.updateStatus).toHaveBeenCalledWith({
      userId: activeUser.id,
      status: 'disabled',
      updatedAt: NOW,
    })
    expect(ctx.userSessionRepository.revokeAllByUserId).toHaveBeenCalledWith(
      activeUser.id,
      NOW,
      'status_changed',
    )

    ctx.userSessionRepository.revokeAllByUserId.mockClear()
    ctx.refreshTokenRepository.revokeAllByUserId.mockClear()
    ctx.sessionStore.deleteAllRefreshTokens.mockClear()
    ctx.userRepository.findById.mockResolvedValue(
      createUser({
        id: activeUser.id,
        status: 'disabled',
      }),
    )

    const unchangedResult = await useCase.execute({
      actorUserId: '55555555-5555-4555-8555-555555555555',
      targetUserId: activeUser.id,
      status: 'disabled',
      accessToken: 'access-token',
      requestId: null,
      userAgent: null,
      ipAddress: null,
    })

    expect(unchangedResult).toEqual({
      clearAuthCookies: false,
    })
    expect(ctx.userSessionRepository.revokeAllByUserId).not.toHaveBeenCalled()
    expect(ctx.refreshTokenRepository.revokeAllByUserId).not.toHaveBeenCalled()
    expect(ctx.sessionStore.deleteAllRefreshTokens).not.toHaveBeenCalled()
  })

  it('soft deletes user once and keeps idempotent behavior for already deleted users', async () => {
    const ctx = createAuthContext()
    ctx.userRepository.findById.mockResolvedValue(createUser())

    const useCase = new SoftDeleteUserUseCase(
      ctx.tokenService as never,
      ctx.sessionStore as never,
      ctx.authUnitOfWork,
    )

    const firstResult = await useCase.execute({
      actorUserId: '55555555-5555-4555-8555-555555555555',
      targetUserId: '11111111-1111-4111-8111-111111111111',
      accessToken: 'access-token',
      requestId: null,
      userAgent: null,
      ipAddress: null,
    })

    expect(firstResult).toEqual({
      clearAuthCookies: true,
    })
    expect(ctx.userRepository.softDelete).toHaveBeenCalledWith({
      userId: '11111111-1111-4111-8111-111111111111',
      deletedAt: NOW,
    })

    ctx.userRepository.softDelete.mockClear()
    ctx.userSessionRepository.revokeAllByUserId.mockClear()
    ctx.refreshTokenRepository.revokeAllByUserId.mockClear()
    ctx.sessionStore.deleteAllRefreshTokens.mockClear()
    ctx.userRepository.findById.mockResolvedValue(
      createUser({
        deletedAt: new Date('2026-05-01T00:00:00.000Z'),
      }),
    )

    const secondResult = await useCase.execute({
      actorUserId: '55555555-5555-4555-8555-555555555555',
      targetUserId: '11111111-1111-4111-8111-111111111111',
      accessToken: 'access-token',
      requestId: null,
      userAgent: null,
      ipAddress: null,
    })

    expect(secondResult).toEqual({
      clearAuthCookies: false,
    })
    expect(ctx.userRepository.softDelete).not.toHaveBeenCalled()
    expect(ctx.userSessionRepository.revokeAllByUserId).not.toHaveBeenCalled()
    expect(ctx.refreshTokenRepository.revokeAllByUserId).not.toHaveBeenCalled()
    expect(ctx.sessionStore.deleteAllRefreshTokens).not.toHaveBeenCalled()
    expect(ctx.authAuditService.recordEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({
        metadata: {
          alreadyDeleted: true,
        },
      }),
    )
  })

  it('maps list and profile responses with pagination and DTO transformations', async () => {
    const user = createUser({
      roles: ['admin', 'user'],
    })
    const listUsersUseCase = new ListUsersUseCase({
      listPaginated: vi.fn(() =>
        Promise.resolve({
          users: [user],
          total: 51,
        }),
      ),
    } as never)

    const listed = await listUsersUseCase.execute({
      page: 2,
      limit: 25,
      search: 'target',
      status: 'active',
    })

    expect(listed.pagination).toEqual({
      page: 2,
      limit: 25,
      total: 51,
      totalPages: 3,
    })
    expect(listed.users[0]).toEqual(
      expect.objectContaining({
        id: user.id,
        role: 'admin',
        roles: ['admin', 'user'],
      }),
    )

    const role = createRole()
    const listRolesUseCase = new ListRolesUseCase({
      listAll: vi.fn(() => Promise.resolve([role])),
    } as never)
    await expect(listRolesUseCase.execute()).resolves.toEqual({
      roles: [
        expect.objectContaining({
          id: role.id,
          code: role.code,
        }),
      ],
    })

    const getUserProfileUseCase = new GetUserProfileUseCase({
      findById: vi.fn(() => Promise.resolve(user)),
    } as never)
    await expect(getUserProfileUseCase.execute(user.id)).resolves.toEqual({
      user: expect.objectContaining({
        id: user.id,
      }),
    })
  })

  it('returns not found when user is missing in profile and user roles queries', async () => {
    const getUserProfileUseCase = new GetUserProfileUseCase({
      findById: vi.fn(() => Promise.resolve(null)),
    } as never)
    const listUserRolesUseCase = new ListUserRolesUseCase(
      {
        findById: vi.fn(() => Promise.resolve(null)),
      } as never,
      {
        listActiveByUserId: vi.fn(),
      } as never,
    )

    await expect(
      getUserProfileUseCase.execute('99999999-9999-4999-8999-999999999999'),
    ).rejects.toThrow(NotFoundError)
    await expect(
      listUserRolesUseCase.execute('99999999-9999-4999-8999-999999999999'),
    ).rejects.toThrow(NotFoundError)
  })
})
