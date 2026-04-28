import { inject, injectable } from 'inversify'

import { TYPES } from '../../../../container/types.js'
import type { IUserRepository } from '../../../identity/domain/repositories/IUserRepository.js'
import { NotFoundError } from '../../../../shared/errors/HttpErrors.js'
import type { UserProfileResponseDto } from '../dtos/AdminDtos.js'
import { toAdminUserDto } from '../dtos/mappers.js'

@injectable()
export class GetUserProfileUseCase {
  public constructor(
    @inject(TYPES.IUserRepository)
    private readonly userRepository: IUserRepository,
  ) {}

  public async execute(userId: string): Promise<UserProfileResponseDto> {
    const user = await this.userRepository.findById(userId)

    if (user === null) {
      throw new NotFoundError('User not found')
    }

    return {
      user: toAdminUserDto(user),
    }
  }
}
