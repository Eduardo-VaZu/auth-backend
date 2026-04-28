import { z } from 'zod'

const oneTimeTokenSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[^.]+$/i,
    'Invalid token format',
  )

export const registerSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
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

export const resetPasswordSchema = z.object({
  token: oneTimeTokenSchema,
  newPassword: z.string().min(8),
})

export const verifyEmailSchema = z.object({
  token: oneTimeTokenSchema,
})
