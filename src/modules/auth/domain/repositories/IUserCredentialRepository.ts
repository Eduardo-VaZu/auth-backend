import type { UserCredential } from '../entities/UserCredential.js'

export interface CreateUserCredentialParams {
  userId: string
  passwordHash: string
  passwordChangedAt?: Date
  passwordVersion?: number
  mustChangePassword?: boolean
}

export interface UpdateUserPasswordParams {
  userId: string
  passwordHash: string
  passwordChangedAt?: Date
  passwordVersion: number
  mustChangePassword?: boolean
}

export interface IUserCredentialRepository {
  findByUserId(userId: string): Promise<UserCredential | null>
  create(params: CreateUserCredentialParams): Promise<UserCredential>
  updatePassword(params: UpdateUserPasswordParams): Promise<UserCredential>
}
