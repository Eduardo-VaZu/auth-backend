import type { Role } from '../../domain/entities/Role.js'
import type { RoleDto } from './AdminDtos.js'

export const toRoleDto = (role: Role): RoleDto => ({
  id: role.id,
  code: role.code,
  name: role.name,
  description: role.description,
  isSystem: role.isSystem,
})
