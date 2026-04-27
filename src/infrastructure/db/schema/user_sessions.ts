import {
  integer,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

import { users } from './users.js'

export const userSessions = pgTable(
  'user_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, {
        onDelete: 'cascade',
      }),
    sessionKey: uuid('session_key').notNull(),
    authzVersion: integer('authz_version').notNull().default(1),
    deviceName: varchar('device_name', { length: 255 }),
    deviceFingerprint: text('device_fingerprint'),
    userAgent: text('user_agent'),
    ipAddress: varchar('ip_address', { length: 64 }),
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedReason: text('revoked_reason'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userSessionsSessionKeyUniqueIdx: uniqueIndex(
      'user_sessions_session_key_unique_idx',
    ).on(table.sessionKey),
    userSessionsUserIdIdx: index('user_sessions_user_id_idx').on(table.userId),
    userSessionsExpiresAtIdx: index('user_sessions_expires_at_idx').on(
      table.expiresAt,
    ),
  }),
)

export type UserSessionRow = typeof userSessions.$inferSelect
export type NewUserSessionRow = typeof userSessions.$inferInsert
