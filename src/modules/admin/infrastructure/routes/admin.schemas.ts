import { z } from 'zod'

export const assignUserRoleSchema = z.object({
  roleId: z.string().uuid(),
})

export const userIdParamSchema = z.object({
  userId: z.string().uuid(),
})

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum(['active', 'disabled', 'locked', 'pending_verification'])
    .optional(),
  q: z.string().trim().min(1).max(255).optional(),
})

export const updateUserStatusSchema = z.object({
  status: z.enum(['active', 'disabled', 'locked']),
})
