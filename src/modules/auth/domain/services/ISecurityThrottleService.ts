export interface LoginThrottleStatus {
  accountLocked: boolean
  ipLocked: boolean
  accountTtlSeconds: number
  ipTtlSeconds: number
}

export interface LoginFailureResult {
  accountAttempts: number
  ipAttempts: number
  accountLocked: boolean
  ipLocked: boolean
  accountLockTtlSeconds: number
  ipLockTtlSeconds: number
  distinctAccountsFromIp: number
  passwordSprayingDetected: boolean
}

export interface ISecurityThrottleService {
  checkLoginAllowed(
    identifier: string,
    ipAddress: string | null,
  ): Promise<LoginThrottleStatus>
  recordLoginFailure(
    identifier: string,
    ipAddress: string | null,
  ): Promise<LoginFailureResult>
  clearAccountLoginFailures(identifier: string): Promise<boolean>
}
