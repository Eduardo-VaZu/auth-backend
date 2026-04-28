import { integer, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core'

import { users } from './users.js'

export const userSecurityState = pgTable('user_security_state', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, {
      onDelete: 'cascade',
    }),
  failedLoginCount: integer('failed_login_count').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  lastFailedLoginAt: timestamp('last_failed_login_at', { withTimezone: true }),
  lastPasswordChangeAt: timestamp('last_password_change_at', {
    withTimezone: true,
  }),
  suspiciousActivityAt: timestamp('suspicious_activity_at', {
    withTimezone: true,
  }),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export type UserSecurityStateRow = typeof userSecurityState.$inferSelect
export type NewUserSecurityStateRow = typeof userSecurityState.$inferInsert
