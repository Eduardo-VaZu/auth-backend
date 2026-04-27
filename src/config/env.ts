import 'dotenv/config'

import { z } from 'zod'

const booleanStringSchema = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')

const envSchema = z.object({
  PORT: z.coerce.number().int().positive(),
  NODE_ENV: z.enum(['development', 'test', 'production']),
  CORS_ORIGIN: z.string().transform((val) => val.split(',').map((url) => url.trim())),
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
