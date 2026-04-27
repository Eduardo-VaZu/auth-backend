import { z } from 'zod'

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
