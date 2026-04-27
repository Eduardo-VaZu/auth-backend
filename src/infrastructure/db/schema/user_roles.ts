import { sql } from 'drizzle-orm'
import {
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

import { roles } from './roles.js'
import { users } from './users.js'

export const userRoles = pgTable(
  'user_roles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, {
        onDelete: 'cascade',
      }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, {
        onDelete: 'cascade',
      }),
    assignedByUserId: uuid('assigned_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    assignedAt: timestamp('assigned_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => ({
    userRolesUserIdIdx: index('user_roles_user_id_idx').on(table.userId),
    userRolesRoleIdIdx: index('user_roles_role_id_idx').on(table.roleId),
    userRolesActiveUniqueIdx: uniqueIndex('user_roles_active_unique_idx')
      .on(table.userId, table.roleId)
      .where(sql`${table.revokedAt} IS NULL`),
  }),
)

export type UserRoleRow = typeof userRoles.$inferSelect
export type NewUserRoleRow = typeof userRoles.$inferInsert
