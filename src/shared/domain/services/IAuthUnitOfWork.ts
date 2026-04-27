import type { IRefreshTokenRepository } from '../../../modules/access/domain/repositories/IRefreshTokenRepository.js'
import type { IUserCredentialRepository } from '../../../modules/credentials/domain/repositories/IUserCredentialRepository.js'
import type { IUserRepository } from '../../../modules/identity/domain/repositories/IUserRepository.js'
import type { IUserSessionRepository } from '../../../modules/access/domain/repositories/IUserSessionRepository.js'
import type { IAuthAuditService } from '../../../modules/audit/domain/services/IAuthAuditService.js'

export interface AuthRepositories {
  refreshTokenRepository: IRefreshTokenRepository
  userCredentialRepository: IUserCredentialRepository
  userRepository: IUserRepository
  userSessionRepository: IUserSessionRepository
  authAuditService: IAuthAuditService
  acquireUserMutationLock: (userId: string) => Promise<void>
}

export interface IAuthUnitOfWork {
  run<T>(callback: (repositories: AuthRepositories) => Promise<T>): Promise<T>
}
