import type { Role } from '../entities/Role.js'

export interface AssignUserRoleParams {
  userId: string
  roleId: string
  assignedByUserId: string | null
}

export interface IUserRoleRepository {
  listActiveByUserId(userId: string): Promise<Role[]>
  assignActiveRole(params: AssignUserRoleParams): Promise<boolean>
  revokeActiveRole(
    userId: string,
    roleId: string,
    revokedAt?: Date,
  ): Promise<boolean>
}
