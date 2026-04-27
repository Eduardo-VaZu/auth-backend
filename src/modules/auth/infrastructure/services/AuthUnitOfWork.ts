import { inject, injectable } from 'inversify'
import { sql } from 'drizzle-orm'
import type { Logger } from 'pino'

import { TYPES } from '../../../../container/types.js'
import { db } from '../../../../infrastructure/db/db.js'
import type {
  AuthUnitOfWorkContext,
  IAuthUnitOfWork,
} from '../../domain/services/IAuthUnitOfWork.js'
import { RefreshTokenRepository } from '../repositories/RefreshTokenRepository.js'
import { UserCredentialRepository } from '../repositories/UserCredentialRepository.js'
import { UserRepository } from '../repositories/UserRepository.js'
import { UserSessionRepository } from '../repositories/UserSessionRepository.js'
import { AuthAuditService } from './AuthAuditService.js'

@injectable()
export class AuthUnitOfWork implements IAuthUnitOfWork {
  public constructor(
    @inject(TYPES.Logger)
    private readonly logger: Logger,
  ) {}

  public async run<TResult>(
    operation: (context: AuthUnitOfWorkContext) => Promise<TResult>,
  ): Promise<TResult> {
    return db.transaction(async (transaction) =>
      operation({
        userRepository: new UserRepository(transaction),
        userCredentialRepository: new UserCredentialRepository(transaction),
        userSessionRepository: new UserSessionRepository(
          transaction,
          this.logger,
        ),
        refreshTokenRepository: new RefreshTokenRepository(
          transaction,
          this.logger,
        ),
        authAuditService: new AuthAuditService(transaction),
        acquireUserMutationLock: async (userId: string): Promise<void> => {
          await transaction.execute(
            sql`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))`,
          )
        },
      }),
    )
  }
}
