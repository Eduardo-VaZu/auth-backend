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

const getBlacklistKey = (jti: string): string => `blacklist:access:${jti}`

const getRefreshTokenKey = (userId: string, jti: string): string =>
  `refresh:${userId}:${jti}`

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
    MATCH: `refresh:${userId}:*`,
    COUNT: 100,
  })) {
    keys.push(key)
  }

  if (keys.length > 0) {
    await redisClient.del(keys)
  }
}

export const disconnectRedis = async (): Promise<void> => {
  if (redisClient.isOpen) {
    await redisClient.quit()
  }
}
