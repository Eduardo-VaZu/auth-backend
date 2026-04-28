import type { Container } from 'inversify'

import { TYPES } from '../../container/types.js'
import { ForgotPasswordUseCase } from './application/use-cases/ForgotPasswordUseCase.js'
import { ResetPasswordUseCase } from './application/use-cases/ResetPasswordUseCase.js'
import { VerifyEmailUseCase } from './application/use-cases/VerifyEmailUseCase.js'
import { ResendVerificationUseCase } from './application/use-cases/ResendVerificationUseCase.js'
import { ChangePasswordUseCase } from './application/use-cases/ChangePasswordUseCase.js'
import { ChangeEmailUseCase } from './application/use-cases/ChangeEmailUseCase.js'
import type { IOneTimeTokenRepository } from './domain/repositories/IOneTimeTokenRepository.js'
import type { IUserCredentialRepository } from './domain/repositories/IUserCredentialRepository.js'
import { OneTimeTokenRepository } from './infrastructure/repositories/OneTimeTokenRepository.js'
import { UserCredentialRepository } from './infrastructure/repositories/UserCredentialRepository.js'
import { CredentialsController } from './infrastructure/controllers/CredentialsController.js'

export const configureCredentialsModule = (container: Container): void => {
  container
    .bind<IUserCredentialRepository>(TYPES.IUserCredentialRepository)
    .to(UserCredentialRepository)
  container
    .bind<IOneTimeTokenRepository>(TYPES.IOneTimeTokenRepository)
    .to(OneTimeTokenRepository)
  container.bind<ChangePasswordUseCase>(TYPES.ChangePasswordUseCase).to(
    ChangePasswordUseCase,
  )
  container.bind<ChangeEmailUseCase>(TYPES.ChangeEmailUseCase).to(
    ChangeEmailUseCase,
  )
  container.bind<ForgotPasswordUseCase>(TYPES.ForgotPasswordUseCase).to(
    ForgotPasswordUseCase,
  )
  container.bind<ResetPasswordUseCase>(TYPES.ResetPasswordUseCase).to(
    ResetPasswordUseCase,
  )
  container.bind<VerifyEmailUseCase>(TYPES.VerifyEmailUseCase).to(
    VerifyEmailUseCase,
  )
  container.bind<ResendVerificationUseCase>(TYPES.ResendVerificationUseCase).to(
    ResendVerificationUseCase,
  )
  container.bind<CredentialsController>(TYPES.CredentialsController).to(
    CredentialsController,
  )
}
