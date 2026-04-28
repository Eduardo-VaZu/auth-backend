import type { Container } from 'inversify'

import { TYPES } from '../../container/types.js'
import { LoginUseCase } from './application/use-cases/LoginUseCase.js'
import { ListSessionsUseCase } from './application/use-cases/ListSessionsUseCase.js'
import { LogoutAllUseCase } from './application/use-cases/LogoutAllUseCase.js'
import { LogoutUseCase } from './application/use-cases/LogoutUseCase.js'
import { RevokeSessionUseCase } from './application/use-cases/RevokeSessionUseCase.js'
import { RefreshTokenUseCase } from './application/use-cases/RefreshTokenUseCase.js'
import type { IRefreshTokenRepository } from './domain/repositories/IRefreshTokenRepository.js'
import type { IUserSessionRepository } from './domain/repositories/IUserSessionRepository.js'
import type { ISecurityThrottleService } from './domain/services/ISecurityThrottleService.js'
import type { ISessionStore } from './domain/services/ISessionStore.js'
import type { ITokenService } from './domain/services/ITokenService.js'
import { AccessController } from './infrastructure/controllers/AccessController.js'
import { RefreshTokenRepository } from './infrastructure/repositories/RefreshTokenRepository.js'
import { UserSessionRepository } from './infrastructure/repositories/UserSessionRepository.js'
import { SecurityThrottleService } from './infrastructure/services/SecurityThrottleService.js'
import { SessionStore } from './infrastructure/services/SessionStore.js'
import { TokenService } from './infrastructure/services/TokenService.js'

export const configureAccessModule = (container: Container): void => {
  container
    .bind<IRefreshTokenRepository>(TYPES.IRefreshTokenRepository)
    .to(RefreshTokenRepository)
  container
    .bind<IUserSessionRepository>(TYPES.IUserSessionRepository)
    .to(UserSessionRepository)
  container.bind<ITokenService>(TYPES.ITokenService).to(TokenService)
  container.bind<ISessionStore>(TYPES.ISessionStore).to(SessionStore)
  container
    .bind<ISecurityThrottleService>(TYPES.ISecurityThrottleService)
    .to(SecurityThrottleService)

  container.bind<LoginUseCase>(TYPES.LoginUseCase).to(LoginUseCase)
  container.bind<ListSessionsUseCase>(TYPES.ListSessionsUseCase).to(ListSessionsUseCase)
  container.bind<RevokeSessionUseCase>(TYPES.RevokeSessionUseCase).to(RevokeSessionUseCase)
  container.bind<RefreshTokenUseCase>(TYPES.RefreshTokenUseCase).to(RefreshTokenUseCase)
  container.bind<LogoutUseCase>(TYPES.LogoutUseCase).to(LogoutUseCase)
  container.bind<LogoutAllUseCase>(TYPES.LogoutAllUseCase).to(LogoutAllUseCase)

  container.bind<AccessController>(TYPES.AccessController).to(AccessController)
}
