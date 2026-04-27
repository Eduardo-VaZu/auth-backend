import type { User, UserRole, UserStatus } from '../entities/User.js'

export interface CreateUserParams {
  email: string
  role?: UserRole
  status?: UserStatus
}

export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>
  findById(id: string): Promise<User | null>
  create(params: CreateUserParams): Promise<User>
  updateLastLoginAt(userId: string, lastLoginAt?: Date): Promise<void>
  markEmailAsVerified(userId: string, verifiedAt?: Date): Promise<void>
}
