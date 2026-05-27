import 'reflect-metadata'

import { afterEach, vi } from 'vitest'

// Set default fallback environment variables for unit tests (especially in CI)
process.env.PORT ??= '3000'
process.env.NODE_ENV ??= 'test'
process.env.CORS_ORIGIN ??= 'http://localhost:3000,http://localhost:5173'
process.env.TRUST_PROXY ??= 'false'
process.env.DATABASE_URL ??=
  'postgres://postgres:postgres@localhost:5432/auth_backend_test'
process.env.DB_POOL_MAX ??= '10'
process.env.DB_POOL_IDLE_TIMEOUT ??= '1000'
process.env.DB_POOL_CONNECTION_TIMEOUT ??= '1000'
process.env.REDIS_URL ??= 'redis://localhost:6379'
process.env.ACCESS_TOKEN_SECRET ??= '12345678901234567890123456789012'
process.env.REFRESH_TOKEN_SECRET ??= 'abcdefghijabcdefghijabcdefghijab'
process.env.ACCESS_TOKEN_EXPIRES_IN ??= '15m'
process.env.REFRESH_TOKEN_EXPIRES_IN ??= '7d'
process.env.COOKIE_SECRET ??= 'cookie-secret-cookie-secret-cookie'
process.env.COOKIE_DOMAIN ??= 'localhost'
process.env.COOKIE_SECURE ??= 'false'
process.env.COOKIE_SAME_SITE ??= 'lax'
process.env.MAX_SESSIONS_PER_USER ??= '5'
process.env.SHUTDOWN_TIMEOUT_MS ??= '5000'
process.env.EMAIL_DELIVERY_MODE ??= 'preview'

afterEach(() => {
  vi.restoreAllMocks()
})
