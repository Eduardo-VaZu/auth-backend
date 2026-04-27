import { pathToFileURL } from 'node:url'

import { inArray } from 'drizzle-orm'

import { closeDatabasePool, db } from '../db.js'
import { roles } from '../schema/index.js'

type BaseRoleCode = 'user' | 'admin'

interface BaseRoleSeed {
  code: BaseRoleCode
  name: string
  description: string
}

const BASE_ROLES: BaseRoleSeed[] = [
  {
    code: 'user',
    name: 'User',
    description: 'Default authenticated user role',
  },
  {
    code: 'admin',
    name: 'Administrator',
    description: 'Administrative role with elevated access',
  },
]

const isDirectExecution = (): boolean => {
  const entrypoint = process.argv[1]

  return (
    entrypoint !== undefined &&
    import.meta.url === pathToFileURL(entrypoint).href
  )
}

const assertBaseRolesPresent = async (): Promise<void> => {
  const requiredCodes = BASE_ROLES.map((role) => role.code)

  const existing = await db
    .select({
      code: roles.code,
    })
    .from(roles)
    .where(inArray(roles.code, requiredCodes))

  const existingCodes = new Set(existing.map((role) => role.code))
  const missing = requiredCodes.filter((code) => !existingCodes.has(code))

  if (missing.length > 0) {
    throw new Error(`Missing required roles after seed: ${missing.join(', ')}`)
  }
}

export const seedBaseRoles = async (): Promise<void> => {
  await db
    .insert(roles)
    .values(
      BASE_ROLES.map((role) => ({
        code: role.code,
        name: role.name,
        description: role.description,
        isSystem: true,
      })),
    )
    .onConflictDoNothing({
      target: roles.code,
    })

  await assertBaseRolesPresent()

  process.stdout.write(
    `Base role seed completed (${BASE_ROLES.map((role) => role.code).join(', ')}).\n`,
  )
}

if (isDirectExecution()) {
  seedBaseRoles()
    .catch((error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'Unknown role seed error'
      process.stderr.write(`${message}\n`)
      process.exitCode = 1
    })
    .finally(async () => {
      await closeDatabasePool()
    })
}
