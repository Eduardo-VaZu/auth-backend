import { inject, injectable } from 'inversify'

import { TYPES } from '../../../../container/types.js'
import {
  redisKeys,
  type AppRedisClient,
} from '../../../../infrastructure/redis.js'
import {
  ACCOUNT_LOCK_THRESHOLD,
  IP_LOCK_THRESHOLD,
  LOCK_BASE_SECONDS,
  LOCK_MAX_SECONDS,
  LOGIN_FAILURE_WINDOW_SECONDS,
  PASSWORD_SPRAY_DISTINCT_ACCOUNT_THRESHOLD,
} from '../../application/constants/security.constants.js'
import type {
  ISecurityThrottleService,
  LoginFailureResult,
  LoginThrottleStatus,
} from '../../domain/services/ISecurityThrottleService.js'

const normalizeTtl = (ttl: number): number => Math.max(ttl, 0)

const calculateLockTtlSeconds = (
  attempts: number,
  threshold: number,
): number => {
  const exponent = Math.max(attempts - threshold, 0)
  const ttl = LOCK_BASE_SECONDS * 2 ** exponent

  return Math.min(ttl, LOCK_MAX_SECONDS)
}

@injectable()
export class SecurityThrottleService implements ISecurityThrottleService {
  public constructor(
    @inject(TYPES.RedisClient)
    private readonly redisClient: AppRedisClient,
  ) {}

  public async checkLoginAllowed(
    identifier: string,
    ipAddress: string | null,
  ): Promise<LoginThrottleStatus> {
    const [accountTtl, ipTtl] = await Promise.all([
      this.redisClient.ttl(redisKeys.throttle.accountLock(identifier)),
      ipAddress === null
        ? Promise.resolve(-2)
        : this.redisClient.ttl(redisKeys.throttle.ipLock(ipAddress)),
    ])

    return {
      accountLocked: accountTtl > 0,
      ipLocked: ipTtl > 0,
      accountTtlSeconds: normalizeTtl(accountTtl),
      ipTtlSeconds: normalizeTtl(ipTtl),
    }
  }

  public async recordLoginFailure(
    identifier: string,
    ipAddress: string | null,
  ): Promise<LoginFailureResult> {
    const accountAttempts = await this.incrementCounter(
      redisKeys.throttle.loginUserAttempts(identifier),
    )
    const ipAttempts =
      ipAddress === null
        ? 0
        : await this.incrementCounter(
            redisKeys.throttle.loginIpAttempts(ipAddress),
          )

    const accountLockTtlSeconds =
      accountAttempts >= ACCOUNT_LOCK_THRESHOLD
        ? calculateLockTtlSeconds(accountAttempts, ACCOUNT_LOCK_THRESHOLD)
        : 0
    const ipLockTtlSeconds =
      ipAttempts >= IP_LOCK_THRESHOLD
        ? calculateLockTtlSeconds(ipAttempts, IP_LOCK_THRESHOLD)
        : 0

    if (accountLockTtlSeconds > 0) {
      await this.redisClient.set(
        redisKeys.throttle.accountLock(identifier),
        String(accountAttempts),
        {
          EX: accountLockTtlSeconds,
        },
      )
    }

    if (ipAddress !== null && ipLockTtlSeconds > 0) {
      await this.redisClient.set(
        redisKeys.throttle.ipLock(ipAddress),
        String(ipAttempts),
        {
          EX: ipLockTtlSeconds,
        },
      )
    }

    const distinctAccountsFromIp = await this.trackDistinctAccountForIp(
      identifier,
      ipAddress,
    )

    return {
      accountAttempts,
      ipAttempts,
      accountLocked: accountLockTtlSeconds > 0,
      ipLocked: ipLockTtlSeconds > 0,
      accountLockTtlSeconds,
      ipLockTtlSeconds,
      distinctAccountsFromIp,
      passwordSprayingDetected:
        distinctAccountsFromIp >= PASSWORD_SPRAY_DISTINCT_ACCOUNT_THRESHOLD,
    }
  }

  public async clearAccountLoginFailures(identifier: string): Promise<boolean> {
    const keys = [
      redisKeys.throttle.loginUserAttempts(identifier),
      redisKeys.throttle.accountLock(identifier),
    ]

    const deleted = await this.redisClient.del(keys)

    return deleted > 0
  }

  private async incrementCounter(key: string): Promise<number> {
    const attempts = await this.redisClient.incr(key)

    if (attempts === 1) {
      await this.redisClient.expire(key, LOGIN_FAILURE_WINDOW_SECONDS)
    }

    return attempts
  }

  private async trackDistinctAccountForIp(
    identifier: string,
    ipAddress: string | null,
  ): Promise<number> {
    if (ipAddress === null) {
      return 0
    }

    const key = redisKeys.throttle.passwordSprayingIp(ipAddress)

    await this.redisClient.sAdd(key, identifier)
    await this.redisClient.expire(key, LOGIN_FAILURE_WINDOW_SECONDS)

    return this.redisClient.sCard(key)
  }
}
