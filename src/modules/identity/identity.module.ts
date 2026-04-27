import type { Container } from 'inversify'

import { TYPES } from '../../container/types.js'
import { RegisterUseCase } from './application/use-cases/RegisterUseCase.js'
import type { IUserRepository } from './domain/repositories/IUserRepository.js'
import { UserRepository } from './infrastructure/repositories/UserRepository.js'
import { IdentityController } from './infrastructure/controllers/IdentityController.js'

export const configureIdentityModule = (container: Container): void => {
  container.bind<IUserRepository>(TYPES.IUserRepository).to(UserRepository)
  container.bind<RegisterUseCase>(TYPES.RegisterUseCase).to(RegisterUseCase)
  container.bind<IdentityController>(TYPES.IdentityController).to(IdentityController)
}
