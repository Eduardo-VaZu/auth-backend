import type { IRefreshTokenRepository } from '../../../modules/access/domain/repositories/IRefreshTokenRepository.js'
import type { IUserCredentialRepository } from '../../../modules/credentials/domain/repositories/IUserCredentialRepository.js'
import type { IOneTimeTokenRepository } from '../../../modules/credentials/domain/repositories/IOneTimeTokenRepository.js'
import type { IUserRepository } from '../../../modules/identity/domain/repositories/IUserRepository.js'
import type { IUserSessionRepository } from '../../../modules/access/domain/repositories/IUserSessionRepository.js'
import type { IAuthAuditService } from '../../../modules/audit/domain/services/IAuthAuditService.js'
import type { IRoleRepository } from '../../../modules/admin/domain/repositories/IRoleRepository.js'
import type { IUserRoleRepository } from '../../../modules/admin/domain/repositories/IUserRoleRepository.js'

export interface AuthRepositories {
  refreshTokenRepository: IRefreshTokenRepository
  userCredentialRepository: IUserCredentialRepository
  oneTimeTokenRepository: IOneTimeTokenRepository
  userRepository: IUserRepository
  roleRepository: IRoleRepository
  userRoleRepository: IUserRoleRepository
  userSessionRepository: IUserSessionRepository
  authAuditService: IAuthAuditService
  acquireUserMutationLock: (userId: string) => Promise<void>
}

export interface IAuthUnitOfWork {
  run<T>(callback: (repositories: AuthRepositories) => Promise<T>): Promise<T>
}
