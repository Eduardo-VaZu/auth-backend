import type { User, UserRole } from '../../domain/entities/User.js'

export interface AuthUserDto {
  id: string
  email: string
  role: UserRole
  roles: UserRole[]
}

export interface RegisterInputDto {
  email: string
  password: string
}

export interface RegisterResultDto {
  user: AuthUserDto
}

export interface LoginInputDto {
  email: string
  password: string
  userAgent: string | null
  ipAddress: string | null
  requestId: string | null
}

export interface LoginResultDto {
  user: AuthUserDto
  accessToken: string
  refreshToken: string
}

export interface RefreshTokenInputDto {
  refreshToken: string
  userAgent: string | null
  ipAddress: string | null
  requestId: string | null
}

export interface RefreshTokenResultDto {
  accessToken: string
  refreshToken: string
}

export interface LogoutInputDto {
  accessToken: string | null
  refreshToken: string | null
  userId: string | null
  sessionKey: string | null
  requestId: string | null
  userAgent: string | null
  ipAddress: string | null
}

export interface LogoutAllInputDto {
  accessToken: string | null
  userId: string | null
  sessionKey: string | null
  requestId: string | null
  userAgent: string | null
  ipAddress: string | null
}

export interface ChangePasswordInputDto {
  userId: string
  currentPassword: string
  newPassword: string
  accessToken: string | null
  sessionKey: string | null
  requestId: string | null
  userAgent: string | null
  ipAddress: string | null
}

export const toAuthUserDto = (user: User): AuthUserDto => ({
  id: user.id,
  email: user.email,
  role: user.primaryRole(),
  roles: user.roles,
})
