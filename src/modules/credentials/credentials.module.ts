import type { Container } from 'inversify'

import { TYPES } from '../../container/types.js'
import { ChangePasswordUseCase } from './application/use-cases/ChangePasswordUseCase.js'
import type { IUserCredentialRepository } from './domain/repositories/IUserCredentialRepository.js'
import { UserCredentialRepository } from './infrastructure/repositories/UserCredentialRepository.js'
import { CredentialsController } from './infrastructure/controllers/CredentialsController.js'

export const configureCredentialsModule = (container: Container): void => {
  container
    .bind<IUserCredentialRepository>(TYPES.IUserCredentialRepository)
    .to(UserCredentialRepository)
  container.bind<ChangePasswordUseCase>(TYPES.ChangePasswordUseCase).to(
    ChangePasswordUseCase,
  )
  container.bind<CredentialsController>(TYPES.CredentialsController).to(
    CredentialsController,
  )
}
