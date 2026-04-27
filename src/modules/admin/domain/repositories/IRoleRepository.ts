import type { Role } from '../entities/Role.js'

export interface IRoleRepository {
  listAll(): Promise<Role[]>
  findById(id: string): Promise<Role | null>
}
