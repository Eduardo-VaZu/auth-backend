export interface RoleDto {
  id: string
  code: string
  name: string
  description: string | null
  isSystem: boolean
}

export interface RolesResponseDto {
  roles: RoleDto[]
}

export interface UserRolesResponseDto {
  userId: string
  roles: RoleDto[]
}

export interface AssignUserRoleInputDto {
  actorUserId: string
  targetUserId: string
  roleId: string
  accessToken: string | null
  requestId: string | null
  userAgent: string | null
  ipAddress: string | null
}

export interface AssignUserRoleResultDto {
  clearAuthCookies: boolean
}

export interface RevokeUserRoleInputDto {
  actorUserId: string
  targetUserId: string
  roleId: string
  accessToken: string | null
  requestId: string | null
  userAgent: string | null
  ipAddress: string | null
}

export interface RevokeUserRoleResultDto {
  clearAuthCookies: boolean
}

export type AdminManagedUserStatus = 'active' | 'disabled' | 'locked'

export interface AdminUserDto {
  id: string
  email: string
  role: UserRole
  roles: UserRole[]
  status: UserStatus
  authzVersion: number
  emailVerifiedAt: string | null
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface AdminUsersPaginationDto {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface ListAdminUsersInputDto {
  page: number
  limit: number
  status?: UserStatus
  search?: string
}

export interface ListAdminUsersResultDto {
  users: AdminUserDto[]
  pagination: AdminUsersPaginationDto
}

export interface UserProfileResponseDto {
  user: AdminUserDto
}

export interface UpdateUserStatusInputDto {
  actorUserId: string
  targetUserId: string
  status: AdminManagedUserStatus
  accessToken: string | null
  requestId: string | null
  userAgent: string | null
  ipAddress: string | null
}

export interface UpdateUserStatusResultDto {
  clearAuthCookies: boolean
}

export interface SoftDeleteUserInputDto {
  actorUserId: string
  targetUserId: string
  accessToken: string | null
  requestId: string | null
  userAgent: string | null
  ipAddress: string | null
}

export interface SoftDeleteUserResultDto {
  clearAuthCookies: boolean
}
import type { UserRole, UserStatus } from '../../../identity/domain/entities/User.js'
