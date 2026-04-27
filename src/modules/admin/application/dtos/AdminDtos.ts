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
