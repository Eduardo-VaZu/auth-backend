import { z } from 'zod'

export const assignUserRoleSchema = z.object({
  roleId: z.string().uuid(),
})
