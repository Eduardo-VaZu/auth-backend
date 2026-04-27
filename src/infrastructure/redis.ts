import { performance } from 'node:perf_hooks'

import type { Logger } from 'pino'
import { createClient } from 'redis'

import { env } from '../config/env.js'

export interface DependencyHealth {
  status: 'ok' | 'error'
  latencyMs: number
}

export const redisClient = createClient({
  url: env.REDIS_URL,
})

export type AppRedisClient = typeof redisClient

export const redisKeys = {
  throttle: {
    loginIpAttempts: (ipAddress: string): string => `login:ip:${ipAddress}`,
    loginUserAttempts: (identifier: string): string =>
      `login:user:${identifier}`,
    passwordResetIpAttempts: (ipAddress: string): string =>
      `password-reset:ip:${ipAddress}`,
    passwordSprayingIp: (ipAddress: string): string =>
      `security:password-spraying:ip:${ipAddress}`,
    accountLock: (identifier: string): string => `security:lock:account:${identifier}`,
    ipLock: (ipAddress: string): string => `security:lock:ip:${ipAddress}`,
  },
  tokens: {
    accessBlacklist: (jti: string): string => `blacklist:access:${jti}`,
    refreshActive: (userId: string, jti: string): string =>
      `refresh:${userId}:${jti}`,
  },
  cache: {
    authzUser: (userId: string): string => `authz:user:${userId}`,
  },
  locks: {
    refresh: (userId: string): string => `lock:refresh:${userId}`,
    userMutation: (userId: string): string => `lock:user-mutation:${userId}`,
  },
} as const

const getBlacklistKey = (jti: string): string =>
  redisKeys.tokens.accessBlacklist(jti)

const getRefreshTokenKey = (userId: string, jti: string): string =>
  redisKeys.tokens.refreshActive(userId, jti)

const ensureRedisConnection = async (): Promise<void> => {
  if (!redisClient.isOpen) {
    await redisClient.connect()
  }
}

const exitOnRedisError = (logger: Logger, error: unknown): never => {
  logger.fatal(
    {
      err: error,
    },
    'Redis connection verification failed',
  )

  process.exit(1)
}

export const verifyRedisConnection = async (logger: Logger): Promise<void> => {
  try {
    const startedAt = performance.now()

    await ensureRedisConnection()
    await redisClient.ping()

    logger.info(
      {
        latencyMs: Number((performance.now() - startedAt).toFixed(2)),
      },
      'Redis connection verified',
    )
  } catch (error: unknown) {
    exitOnRedisError(logger, error)
  }
}

export const checkRedisHealth = async (): Promise<DependencyHealth> => {
  const startedAt = performance.now()

  try {
    await ensureRedisConnection()
    await redisClient.ping()

    return {
      status: 'ok',
      latencyMs: Number((performance.now() - startedAt).toFixed(2)),
    }
  } catch {
    return {
      status: 'error',
      latencyMs: Number((performance.now() - startedAt).toFixed(2)),
    }
  }
}

export const setBlacklist = async (
  jti: string,
  ttlSeconds: number,
): Promise<void> => {
  if (ttlSeconds <= 0) {
    return
  }

  await ensureRedisConnection()
  await redisClient.set(getBlacklistKey(jti), '1', {
    EX: ttlSeconds,
  })
}

export const isBlacklisted = async (jti: string): Promise<boolean> => {
  await ensureRedisConnection()

  const exists = await redisClient.exists(getBlacklistKey(jti))

  return exists === 1
}

export const setRefreshToken = async (
  userId: string,
  jti: string,
  ttlSeconds: number,
): Promise<void> => {
  if (ttlSeconds <= 0) {
    return
  }

  await ensureRedisConnection()
  await redisClient.set(getRefreshTokenKey(userId, jti), '1', {
    EX: ttlSeconds,
  })
}

export const getRefreshToken = async (
  userId: string,
  jti: string,
): Promise<boolean> => {
  await ensureRedisConnection()

  const exists = await redisClient.exists(getRefreshTokenKey(userId, jti))

  return exists === 1
}

export const deleteRefreshToken = async (
  userId: string,
  jti: string,
): Promise<void> => {
  await ensureRedisConnection()
  await redisClient.del(getRefreshTokenKey(userId, jti))
}

export const deleteAllRefreshTokens = async (userId: string): Promise<void> => {
  await ensureRedisConnection()

  const keys: string[] = []

  for await (const key of redisClient.scanIterator({
    MATCH: `${redisKeys.tokens.refreshActive(userId, '*')}`,
    COUNT: 100,
  })) {
    keys.push(key)
  }

  if (keys.length > 0) {
    await redisClient.del(keys)
  }
}

export const cacheAuthzSnapshot = async (
  userId: string,
  value: string,
  ttlSeconds: number,
): Promise<void> => {
  if (ttlSeconds <= 0) {
    return
  }

  await ensureRedisConnection()
  await redisClient.set(redisKeys.cache.authzUser(userId), value, {
    EX: ttlSeconds,
  })
}

export const getCachedAuthzSnapshot = async (
  userId: string,
): Promise<string | null> => {
  await ensureRedisConnection()

  return redisClient.get(redisKeys.cache.authzUser(userId))
}

export const deleteCachedAuthzSnapshot = async (userId: string): Promise<void> => {
  await ensureRedisConnection()
  await redisClient.del(redisKeys.cache.authzUser(userId))
}

export const acquireRefreshLock = async (
  userId: string,
  ttlSeconds: number,
): Promise<boolean> => {
  if (ttlSeconds <= 0) {
    return false
  }

  await ensureRedisConnection()

  const result = await redisClient.set(redisKeys.locks.refresh(userId), '1', {
    EX: ttlSeconds,
    NX: true,
  })

  return result === 'OK'
}

export const releaseRefreshLock = async (userId: string): Promise<void> => {
  await ensureRedisConnection()
  await redisClient.del(redisKeys.locks.refresh(userId))
}

export const acquireUserMutationLock = async (
  userId: string,
  ttlSeconds: number,
): Promise<boolean> => {
  if (ttlSeconds <= 0) {
    return false
  }

  await ensureRedisConnection()

  const result = await redisClient.set(
    redisKeys.locks.userMutation(userId),
    '1',
    {
      EX: ttlSeconds,
      NX: true,
    },
  )

  return result === 'OK'
}

export const releaseUserMutationLock = async (userId: string): Promise<void> => {
  await ensureRedisConnection()
  await redisClient.del(redisKeys.locks.userMutation(userId))
}

export const disconnectRedis = async (): Promise<void> => {
  if (redisClient.isOpen) {
    await redisClient.quit()
  }
}
