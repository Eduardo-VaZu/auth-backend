import { z } from 'zod'

export const listAuditLogsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    userId: z.string().uuid().optional(),
    actorUserId: z.string().uuid().optional(),
    requestId: z.string().uuid().optional(),
    eventType: z.string().trim().min(1).max(128).optional(),
    eventStatus: z.enum(['success', 'failure', 'blocked', 'incident']).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .superRefine((value, context) => {
    if (value.from !== undefined && value.to !== undefined && value.from > value.to) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['to'],
        message: '`to` must be greater than or equal to `from`',
      })
    }
  })
