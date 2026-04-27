import { pathToFileURL } from 'node:url'

import { eq, isNull, sql } from 'drizzle-orm'

import { closeDatabasePool, db, pool } from '../db.js'
import { userCredentials, users } from '../schema/index.js'

interface LegacyCredentialCandidate {
  userId: string
  passwordHash: string
  createdAt: Date
}

const isDirectExecution = (): boolean => {
  const entrypoint = process.argv[1]

  return (
    entrypoint !== undefined &&
    import.meta.url === pathToFileURL(entrypoint).href
  )
}

const isUndefinedColumnError = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) {
    return false
  }

  const code = (error as { code?: unknown }).code

  return code === '42703'
}

const loadLegacyCredentialCandidates = async (): Promise<
  LegacyCredentialCandidate[]
> => {
  try {
    const result = await pool.query<LegacyCredentialCandidate>(`
      SELECT
        users.id AS "userId",
        users.password_hash AS "passwordHash",
        users.created_at AS "createdAt"
      FROM users
      LEFT JOIN user_credentials
        ON users.id = user_credentials.user_id
      WHERE user_credentials.id IS NULL
        AND users.password_hash IS NOT NULL
    `)

    return result.rows
  } catch (error: unknown) {
    if (isUndefinedColumnError(error)) {
      return []
    }

    throw error
  }
}

const countUsersWithoutCredentials = async (): Promise<number> => {
  const [result] = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(users)
    .leftJoin(userCredentials, eq(users.id, userCredentials.userId))
    .where(isNull(userCredentials.id))

  return result === undefined ? 0 : Number(result.count)
}

export const runLegacyCredentialMigration = async (): Promise<void> => {
  const candidates = await loadLegacyCredentialCandidates()

  if (candidates.length > 0) {
    await db.transaction(async (transaction) => {
      await transaction
        .insert(userCredentials)
        .values(
          candidates.map((candidate) => ({
            userId: candidate.userId,
            passwordHash: candidate.passwordHash,
            passwordChangedAt: candidate.createdAt,
            passwordVersion: 1,
            mustChangePassword: false,
            createdAt: candidate.createdAt,
            updatedAt: candidate.createdAt,
          })),
        )
        .onConflictDoNothing({
          target: userCredentials.userId,
        })
    })
  }

  const usersWithoutCredentials = await countUsersWithoutCredentials()

  if (usersWithoutCredentials > 0) {
    throw new Error(
      `Legacy credential migration incomplete: ${usersWithoutCredentials} users still have no credential row.`,
    )
  }

  process.stdout.write(
    `Legacy credential migration completed. Migrated ${candidates.length} credential records.\n`,
  )
}

if (isDirectExecution()) {
  runLegacyCredentialMigration()
    .catch((error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'Unknown migration error'
      process.stderr.write(`${message}\n`)
      process.exitCode = 1
    })
    .finally(async () => {
      await closeDatabasePool()
    })
}
