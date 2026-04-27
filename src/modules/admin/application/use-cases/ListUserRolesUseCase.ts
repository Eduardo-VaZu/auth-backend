import { inject, injectable } from 'inversify'

import { TYPES } from '../../../../container/types.js'
import { NotFoundError } from '../../../../shared/errors/HttpErrors.js'
import type { IUserRepository } from '../../../identity/domain/repositories/IUserRepository.js'
import type { UserRolesResponseDto } from '../dtos/AdminDtos.js'
import { toRoleDto } from '../dtos/mappers.js'
import type { IUserRoleRepository } from '../../domain/repositories/IUserRoleRepository.js'

@injectable()
export class ListUserRolesUseCase {
  public constructor(
    @inject(TYPES.IUserRepository)
    private readonly userRepository: IUserRepository,
    @inject(TYPES.IUserRoleRepository)
    private readonly userRoleRepository: IUserRoleRepository,
  ) {}

  public async execute(userId: string): Promise<UserRolesResponseDto> {
    const user = await this.userRepository.findById(userId)

    if (user === null) {
      throw new NotFoundError('User not found')
    }

    const roles = await this.userRoleRepository.listActiveByUserId(userId)

    return {
      userId,
      roles: roles.map(toRoleDto),
    }
  }
}
