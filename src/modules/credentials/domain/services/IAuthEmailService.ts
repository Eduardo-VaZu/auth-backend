export interface EmailDispatchResult {
  previewToken: string | null
}

export interface SendPasswordResetEmailParams {
  email: string
  token: string
  expiresAt: Date
  requestId: string | null
}

export interface SendVerificationEmailParams {
  email: string
  token: string
  expiresAt: Date
  requestId: string | null
  reason: 'register' | 'resend_verification' | 'email_change'
}

export interface IAuthEmailService {
  sendPasswordResetEmail(
    params: SendPasswordResetEmailParams,
  ): Promise<EmailDispatchResult>
  sendVerificationEmail(
    params: SendVerificationEmailParams,
  ): Promise<EmailDispatchResult>
}
