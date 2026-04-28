import type { Role } from '../../domain/entities/Role.js'
import type { User } from '../../../identity/domain/entities/User.js'
import type { AdminUserDto, RoleDto } from './AdminDtos.js'

export const toRoleDto = (role: Role): RoleDto => ({
  id: role.id,
  code: role.code,
  name: role.name,
  description: role.description,
  isSystem: role.isSystem,
})

export const toAdminUserDto = (user: User): AdminUserDto => ({
  id: user.id,
  email: user.email,
  role: user.primaryRole(),
  roles: user.roles,
  status: user.status,
  authzVersion: user.authzVersion,
  emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
  lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString(),
  deletedAt: user.deletedAt?.toISOString() ?? null,
})
