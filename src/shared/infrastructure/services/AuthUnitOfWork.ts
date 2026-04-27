import { sql } from 'drizzle-orm'
import { injectable } from 'inversify'

import { db, type AppTransaction } from '../../../infrastructure/db/db.js'
import { RefreshTokenRepository } from '../../../modules/access/infrastructure/repositories/RefreshTokenRepository.js'
import { RoleRepository } from '../../../modules/admin/infrastructure/repositories/RoleRepository.js'
import { UserRoleRepository } from '../../../modules/admin/infrastructure/repositories/UserRoleRepository.js'
import { UserSessionRepository } from '../../../modules/access/infrastructure/repositories/UserSessionRepository.js'
import { OneTimeTokenRepository } from '../../../modules/credentials/infrastructure/repositories/OneTimeTokenRepository.js'
import { UserCredentialRepository } from '../../../modules/credentials/infrastructure/repositories/UserCredentialRepository.js'
import { UserRepository } from '../../../modules/identity/infrastructure/repositories/UserRepository.js'
import { AuthAuditService } from '../../../modules/audit/infrastructure/services/AuthAuditService.js'
import type {
  AuthRepositories,
  IAuthUnitOfWork,
} from '../../domain/services/IAuthUnitOfWork.js'

@injectable()
export class AuthUnitOfWork implements IAuthUnitOfWork {
  public async run<T>(
    callback: (repositories: AuthRepositories) => Promise<T>,
  ): Promise<T> {
    return db.transaction(async (transaction: AppTransaction) => {
      const refreshTokenRepository = new RefreshTokenRepository(transaction)
      const userCredentialRepository = new UserCredentialRepository(transaction)
      const oneTimeTokenRepository = new OneTimeTokenRepository(transaction)
      const userRepository = new UserRepository(transaction)
      const roleRepository = new RoleRepository(transaction)
      const userRoleRepository = new UserRoleRepository(transaction)
      const userSessionRepository = new UserSessionRepository(transaction)
      const authAuditService = new AuthAuditService(transaction)

      const acquireUserMutationLock = async (userId: string): Promise<void> => {
        await transaction.execute(
          // lock user to prevent concurrent session/credential mutations
          // pg_advisory_xact_lock uses bigint, we hash the uuid to a numeric key
          // using a stable hash for the same userId
          sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`,
        )
      }

      return callback({
        refreshTokenRepository,
        userCredentialRepository,
        oneTimeTokenRepository,
        userRepository,
        roleRepository,
        userRoleRepository,
        userSessionRepository,
        authAuditService,
        acquireUserMutationLock,
      })
    })
  }
}
