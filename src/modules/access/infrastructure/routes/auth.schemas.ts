import { z } from 'zod'

const oneTimeTokenSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[^.]+$/i,
    'Invalid token format',
  )

// OWASP-DEMO (A04 - Insecure Design / A08 - Data Integrity Failures):
// Accepting `role` and `status` in the public registration payload is
// classic mass assignment: the client controls fields that should be
// server-owned. Any anonymous caller can now request admin+active on
// registration.
export const registerSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
  role: z.enum(['user', 'admin']).optional(),
  status: z
    .enum(['active', 'disabled', 'locked', 'pending_verification'])
    .optional(),
})

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8),
})

export const changeEmailSchema = z.object({
  email: z.string().trim().email(),
})

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email(),
})

export const resendVerificationSchema = z.object({
  email: z.string().trim().email(),
})

export const resetPasswordSchema = z.object({
  token: oneTimeTokenSchema,
  newPassword: z.string().min(8),
})

export const verifyEmailSchema = z.object({
  token: oneTimeTokenSchema,
})
