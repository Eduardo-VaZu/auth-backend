export interface OneTimeTokenDispatchResultDto {
  previewToken: string | null
}

export interface ForgotPasswordInputDto {
  email: string
  requestId: string | null
  userAgent: string | null
  ipAddress: string | null
}

export interface ResetPasswordInputDto {
  token: string
  newPassword: string
  requestId: string | null
  userAgent: string | null
  ipAddress: string | null
}

export interface VerifyEmailInputDto {
  token: string
  requestId: string | null
  userAgent: string | null
  ipAddress: string | null
}

export interface ResendVerificationInputDto {
  email: string
  requestId: string | null
  userAgent: string | null
  ipAddress: string | null
}

export interface ChangeEmailInputDto {
  userId: string
  email: string
  accessToken: string | null
  sessionKey: string | null
  requestId: string | null
  userAgent: string | null
  ipAddress: string | null
}
