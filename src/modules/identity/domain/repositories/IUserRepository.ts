import type { User, UserRole, UserStatus } from '../entities/User.js'

export interface CreateUserParams {
  email: string
  role?: UserRole
  status?: UserStatus
}

export interface ListUsersPaginatedParams {
  limit: number
  offset: number
  status?: UserStatus
  search?: string
}

export interface ListUsersPaginatedResult {
  users: User[]
  total: number
}

export interface UpdateUserStatusParams {
  userId: string
  status: UserStatus
  updatedAt?: Date
}

export interface SoftDeleteUserParams {
  userId: string
  deletedAt?: Date
}

export interface UpdateUserEmailForReverificationParams {
  userId: string
  email: string
  updatedAt?: Date
}

export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>
  findById(id: string): Promise<User | null>
  create(params: CreateUserParams): Promise<User>
  updateLastLoginAt(userId: string, lastLoginAt?: Date): Promise<void>
  markEmailAsVerified(userId: string, verifiedAt?: Date): Promise<void>
  listPaginated(
    params: ListUsersPaginatedParams,
  ): Promise<ListUsersPaginatedResult>
  updateStatus(params: UpdateUserStatusParams): Promise<User | null>
  softDelete(params: SoftDeleteUserParams): Promise<User | null>
  updateEmailForReverification(
    params: UpdateUserEmailForReverificationParams,
  ): Promise<User | null>
}
