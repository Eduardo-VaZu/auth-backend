import { Container } from 'inversify'
import type { Pool } from 'pg'
import type { Logger } from 'pino'

import { pool } from '../infrastructure/db/db.js'
import { redisClient, type AppRedisClient } from '../infrastructure/redis.js'
import type { IUserCredentialRepository } from '../modules/auth/domain/repositories/IUserCredentialRepository.js'
import type { IRefreshTokenRepository } from '../modules/auth/domain/repositories/IRefreshTokenRepository.js'
import type { IUserSessionRepository } from '../modules/auth/domain/repositories/IUserSessionRepository.js'
import type { IUserRepository } from '../modules/auth/domain/repositories/IUserRepository.js'
import type { IAuthAuditService } from '../modules/auth/domain/services/IAuthAuditService.js'
import type { IAuthUnitOfWork } from '../modules/auth/domain/services/IAuthUnitOfWork.js'
import type { ISessionStore } from '../modules/auth/domain/services/ISessionStore.js'
import type { ISecurityThrottleService } from '../modules/auth/domain/services/ISecurityThrottleService.js'
import type { ITokenService } from '../modules/auth/domain/services/ITokenService.js'
import { ChangePasswordUseCase } from '../modules/auth/application/use-cases/ChangePasswordUseCase.js'
import { LoginUseCase } from '../modules/auth/application/use-cases/LoginUseCase.js'
import { LogoutAllUseCase } from '../modules/auth/application/use-cases/LogoutAllUseCase.js'
import { LogoutUseCase } from '../modules/auth/application/use-cases/LogoutUseCase.js'
import { RefreshTokenUseCase } from '../modules/auth/application/use-cases/RefreshTokenUseCase.js'
import { RegisterUseCase } from '../modules/auth/application/use-cases/RegisterUseCase.js'
import { AuthController } from '../modules/auth/infrastructure/controllers/AuthController.js'
import { RefreshTokenRepository } from '../modules/auth/infrastructure/repositories/RefreshTokenRepository.js'
import { UserCredentialRepository } from '../modules/auth/infrastructure/repositories/UserCredentialRepository.js'
import { UserSessionRepository } from '../modules/auth/infrastructure/repositories/UserSessionRepository.js'
import { UserRepository } from '../modules/auth/infrastructure/repositories/UserRepository.js'
import { AuthAuditService } from '../modules/auth/infrastructure/services/AuthAuditService.js'
import { AuthUnitOfWork } from '../modules/auth/infrastructure/services/AuthUnitOfWork.js'
import { SecurityThrottleService } from '../modules/auth/infrastructure/services/SecurityThrottleService.js'
import { SessionStore } from '../modules/auth/infrastructure/services/SessionStore.js'
import { TokenService } from '../modules/auth/infrastructure/services/TokenService.js'
import { HealthController } from '../modules/health/HealthController.js'
import { appLogger } from '../shared/logger/logger.js'
import { TYPES } from './types.js'

export const container = new Container({
  defaultScope: 'Singleton',
})

container.bind<Logger>(TYPES.Logger).toConstantValue(appLogger)
container.bind<Pool>(TYPES.DbPool).toConstantValue(pool)
container.bind<AppRedisClient>(TYPES.RedisClient).toConstantValue(redisClient)

container.bind<IUserRepository>(TYPES.IUserRepository).to(UserRepository)
container
  .bind<IUserCredentialRepository>(TYPES.IUserCredentialRepository)
  .to(UserCredentialRepository)
container
  .bind<IUserSessionRepository>(TYPES.IUserSessionRepository)
  .to(UserSessionRepository)
container
  .bind<IRefreshTokenRepository>(TYPES.IRefreshTokenRepository)
  .to(RefreshTokenRepository)
container.bind<ITokenService>(TYPES.ITokenService).to(TokenService)
container.bind<ISessionStore>(TYPES.ISessionStore).to(SessionStore)
container.bind<IAuthAuditService>(TYPES.IAuthAuditService).to(AuthAuditService)
container.bind<IAuthUnitOfWork>(TYPES.IAuthUnitOfWork).to(AuthUnitOfWork)
container
  .bind<ISecurityThrottleService>(TYPES.ISecurityThrottleService)
  .to(SecurityThrottleService)

container.bind<RegisterUseCase>(TYPES.RegisterUseCase).to(RegisterUseCase)
container.bind<LoginUseCase>(TYPES.LoginUseCase).to(LoginUseCase)
container
  .bind<RefreshTokenUseCase>(TYPES.RefreshTokenUseCase)
  .to(RefreshTokenUseCase)
container.bind<LogoutUseCase>(TYPES.LogoutUseCase).to(LogoutUseCase)
container.bind<LogoutAllUseCase>(TYPES.LogoutAllUseCase).to(LogoutAllUseCase)
container
  .bind<ChangePasswordUseCase>(TYPES.ChangePasswordUseCase)
  .to(ChangePasswordUseCase)

container.bind<HealthController>(TYPES.HealthController).to(HealthController)
container.bind<AuthController>(TYPES.AuthController).to(AuthController)
