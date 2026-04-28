import { inject, injectable } from 'inversify'

import { TYPES } from '../../../../container/types.js'
import type { IUserRepository } from '../../../identity/domain/repositories/IUserRepository.js'
import type {
  ListAdminUsersInputDto,
  ListAdminUsersResultDto,
} from '../dtos/AdminDtos.js'
import { toAdminUserDto } from '../dtos/mappers.js'

@injectable()
export class ListUsersUseCase {
  public constructor(
    @inject(TYPES.IUserRepository)
    private readonly userRepository: IUserRepository,
  ) {}

  public async execute(input: ListAdminUsersInputDto): Promise<ListAdminUsersResultDto> {
    const offset = (input.page - 1) * input.limit
    const { users, total } = await this.userRepository.listPaginated({
      limit: input.limit,
      offset,
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.search !== undefined ? { search: input.search } : {}),
    })

    return {
      users: users.map(toAdminUserDto),
      pagination: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.max(Math.ceil(total / input.limit), 1),
      },
    }
  }
}
