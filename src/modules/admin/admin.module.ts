import type { Container } from 'inversify'

import { TYPES } from '../../container/types.js'
import { AssignUserRoleUseCase } from './application/use-cases/AssignUserRoleUseCase.js'
import { ListRolesUseCase } from './application/use-cases/ListRolesUseCase.js'
import { ListUserRolesUseCase } from './application/use-cases/ListUserRolesUseCase.js'
import { RevokeUserRoleUseCase } from './application/use-cases/RevokeUserRoleUseCase.js'
import type { IRoleRepository } from './domain/repositories/IRoleRepository.js'
import type { IUserRoleRepository } from './domain/repositories/IUserRoleRepository.js'
import { AdminController } from './infrastructure/controllers/AdminController.js'
import { RoleRepository } from './infrastructure/repositories/RoleRepository.js'
import { UserRoleRepository } from './infrastructure/repositories/UserRoleRepository.js'

export const configureAdminModule = (container: Container): void => {
  container.bind<IRoleRepository>(TYPES.IRoleRepository).to(RoleRepository)
  container.bind<IUserRoleRepository>(TYPES.IUserRoleRepository).to(
    UserRoleRepository,
  )

  container.bind<ListRolesUseCase>(TYPES.ListRolesUseCase).to(ListRolesUseCase)
  container
    .bind<ListUserRolesUseCase>(TYPES.ListUserRolesUseCase)
    .to(ListUserRolesUseCase)
  container
    .bind<AssignUserRoleUseCase>(TYPES.AssignUserRoleUseCase)
    .to(AssignUserRoleUseCase)
  container
    .bind<RevokeUserRoleUseCase>(TYPES.RevokeUserRoleUseCase)
    .to(RevokeUserRoleUseCase)

  container.bind<AdminController>(TYPES.AdminController).to(AdminController)
}
