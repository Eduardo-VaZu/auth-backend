import type { IRefreshTokenRepository } from '../repositories/IRefreshTokenRepository.js'
import type { IUserCredentialRepository } from '../repositories/IUserCredentialRepository.js'
import type { IUserRepository } from '../repositories/IUserRepository.js'
import type { IUserSessionRepository } from '../repositories/IUserSessionRepository.js'
import type { IAuthAuditService } from './IAuthAuditService.js'

export interface AuthUnitOfWorkContext {
  userRepository: IUserRepository
  userCredentialRepository: IUserCredentialRepository
  userSessionRepository: IUserSessionRepository
  refreshTokenRepository: IRefreshTokenRepository
  authAuditService: IAuthAuditService
  acquireUserMutationLock(this: void, userId: string): Promise<void>
}

export interface IAuthUnitOfWork {
  run<TResult>(
    operation: (context: AuthUnitOfWorkContext) => Promise<TResult>,
  ): Promise<TResult>
}
