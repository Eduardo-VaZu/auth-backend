import { inject, injectable } from 'inversify'
import type { Logger } from 'pino'

import { env } from '../../../../config/env.js'
import { TYPES } from '../../../../container/types.js'
import { InternalError } from '../../../../shared/errors/HttpErrors.js'
import type {
  EmailDispatchResult,
  IAuthEmailService,
  SendPasswordResetEmailParams,
  SendVerificationEmailParams,
} from '../../domain/services/IAuthEmailService.js'

interface BrevoRecipient {
  email: string
}

interface BrevoPayload {
  sender: {
    email: string
    name: string
  }
  to: BrevoRecipient[]
  subject: string
  textContent: string
}

const formatExpiresAt = (expiresAt: Date): string => expiresAt.toISOString()

@injectable()
export class AuthEmailService implements IAuthEmailService {
  public constructor(
    @inject(TYPES.Logger)
    private readonly logger: Logger,
  ) {}

  public async sendPasswordResetEmail(
    params: SendPasswordResetEmailParams,
  ): Promise<EmailDispatchResult> {
    const subject = 'Password reset instructions'
    const textContent = [
      'Use this token to reset your password.',
      `Token: ${params.token}`,
      `Expires at: ${formatExpiresAt(params.expiresAt)}`,
      'Endpoint: POST /auth/reset-password',
    ].join('\n')

    return this.dispatchEmail({
      email: params.email,
      subject,
      textContent,
      previewToken: params.token,
      requestId: params.requestId,
    })
  }

  public async sendVerificationEmail(
    params: SendVerificationEmailParams,
  ): Promise<EmailDispatchResult> {
    const subject = 'Verify your email'
    const textContent = [
      'Use this token to verify your email.',
      `Token: ${params.token}`,
      `Expires at: ${formatExpiresAt(params.expiresAt)}`,
      'Endpoint: POST /auth/verify-email',
      `Reason: ${params.reason}`,
    ].join('\n')

    return this.dispatchEmail({
      email: params.email,
      subject,
      textContent,
      previewToken: params.token,
      requestId: params.requestId,
    })
  }

  private async dispatchEmail(params: {
    email: string
    subject: string
    textContent: string
    previewToken: string
    requestId: string | null
  }): Promise<EmailDispatchResult> {
    if (env.EMAIL_DELIVERY_MODE === 'preview') {
      this.logger.info(
        {
          requestId: params.requestId,
          recipient: params.email,
          subject: params.subject,
          previewToken: params.previewToken,
        },
        'Auth email generated in preview mode',
      )

      return {
        previewToken: params.previewToken,
      }
    }

    const payload: BrevoPayload = {
      sender: {
        email: env.BREVO_SENDER_EMAIL!,
        name: env.BREVO_SENDER_NAME,
      },
      to: [
        {
          email: params.email,
        },
      ],
      subject: params.subject,
      textContent: params.textContent,
    }

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': env.BREVO_API_KEY!,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const responseBody = await response.text()

      this.logger.error(
        {
          requestId: params.requestId,
          recipient: params.email,
          statusCode: response.status,
          responseBody,
        },
        'Brevo email dispatch failed',
      )

      throw new InternalError('Failed to dispatch authentication email')
    }

    return {
      previewToken: null,
    }
  }
}
