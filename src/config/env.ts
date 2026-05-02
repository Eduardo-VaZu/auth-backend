import 'dotenv/config'

import { z } from 'zod'

const booleanStringSchema = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')

const envSchema = z.object({
  PORT: z.coerce.number().int().positive(),
  NODE_ENV: z.enum(['development', 'test', 'production']),
  CORS_ORIGIN: z
    .string()
    .transform((val) => val.split(',').map((url) => url.trim())),
  TRUST_PROXY: booleanStringSchema,
  DATABASE_URL: z.string().min(1),
  DB_POOL_MAX: z.coerce.number().int().positive(),
  DB_POOL_IDLE_TIMEOUT: z.coerce.number().int().nonnegative(),
  DB_POOL_CONNECTION_TIMEOUT: z.coerce.number().int().nonnegative(),
  REDIS_URL: z.string().min(1),
  ACCESS_TOKEN_SECRET: z.string().min(32),
  REFRESH_TOKEN_SECRET: z.string().min(32),
  ACCESS_TOKEN_EXPIRES_IN: z.string().min(1),
  REFRESH_TOKEN_EXPIRES_IN: z.string().min(1),
  COOKIE_SECRET: z.string().min(32),
  COOKIE_DOMAIN: z.string().min(1),
  COOKIE_SECURE: booleanStringSchema,
  COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']),
  MAX_SESSIONS_PER_USER: z.coerce.number().int().positive(),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive(),
  EMAIL_DELIVERY_MODE: z.enum(['preview', 'brevo']).default('preview'),
  BREVO_API_KEY: z.string().min(1).optional(),
  BREVO_SENDER_EMAIL: z.string().email().optional(),
  BREVO_SENDER_NAME: z.string().min(1).default('Auth Backend'),
  EXPIRED_SESSION_RETENTION_SECONDS: z.coerce.number().int().nonnegative().default(0),
}).superRefine((value, context) => {
  if (value.NODE_ENV === 'production' && value.EMAIL_DELIVERY_MODE !== 'brevo') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['EMAIL_DELIVERY_MODE'],
      message: 'Production requires EMAIL_DELIVERY_MODE=brevo',
    })
  }

  if (value.EMAIL_DELIVERY_MODE === 'brevo') {
    if (value.BREVO_API_KEY === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['BREVO_API_KEY'],
        message: 'BREVO_API_KEY is required when EMAIL_DELIVERY_MODE=brevo',
      })
    }

    if (value.BREVO_SENDER_EMAIL === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['BREVO_SENDER_EMAIL'],
        message:
          'BREVO_SENDER_EMAIL is required when EMAIL_DELIVERY_MODE=brevo',
      })
    }
  }
})

const formatIssues = (issues: z.ZodIssue[]): string => {
  const details = issues.map((issue) => {
    const field = issue.path.join('.') || 'environment'

    return `- ${field}: ${issue.message}`
  })

  return ['Invalid environment configuration.', ...details].join('\n')
}

const exitWithEnvError = (message: string): never => {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}

const parsedEnv = envSchema.safeParse(process.env)

export const env = parsedEnv.success
  ? parsedEnv.data
  : exitWithEnvError(formatIssues(parsedEnv.error.issues))

export type Env = typeof env
