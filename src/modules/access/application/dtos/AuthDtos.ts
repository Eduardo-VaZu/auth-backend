import type { User, UserRole } from '../../../identity/domain/entities/User.js'

export interface AuthUserDto {
  id: string
  email: string
  role: UserRole
  roles: UserRole[]
}

export interface RegisterInputDto {
  email: string
  password: string
  requestId: string | null
}

export interface RegisterResultDto {
  user: AuthUserDto
  verificationRequired: true
  message: string
  previewToken?: string
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

export interface SessionItemDto {
  id: string
  deviceName: string | null
  userAgent: string | null
  ipAddress: string | null
  lastActivityAt: string
  expiresAt: string
  createdAt: string
  isCurrent: boolean
}

export interface SessionsResultDto {
  sessions: SessionItemDto[]
}

export interface RevokeSessionInputDto {
  sessionId: string
  userId: string
  currentSessionKey: string | null
  accessToken: string | null
  requestId: string | null
  userAgent: string | null
  ipAddress: string | null
}

export interface RevokeSessionResultDto {
  isCurrentSession: boolean
}

export const toAuthUserDto = (user: User): AuthUserDto => ({
  id: user.id,
  email: user.email,
  role: user.primaryRole(),
  roles: user.roles,
})
