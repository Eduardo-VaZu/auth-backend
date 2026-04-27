import { inject, injectable } from 'inversify'

import { TYPES } from '../../../../container/types.js'
import type { RolesResponseDto } from '../dtos/AdminDtos.js'
import { toRoleDto } from '../dtos/mappers.js'
import type { IRoleRepository } from '../../domain/repositories/IRoleRepository.js'

@injectable()
export class ListRolesUseCase {
  public constructor(
    @inject(TYPES.IRoleRepository)
    private readonly roleRepository: IRoleRepository,
  ) {}

  public async execute(): Promise<RolesResponseDto> {
    const roles = await this.roleRepository.listAll()

    return {
      roles: roles.map(toRoleDto),
    }
  }
}
