import {
  type AnyPgColumn,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

import { userSessions } from './user_sessions.js'

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    jti: uuid('jti').notNull(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => userSessions.id, {
        onDelete: 'cascade',
      }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    replacedByTokenId: uuid('replaced_by_token_id').references(
      (): AnyPgColumn => refreshTokens.id,
      {
        onDelete: 'set null',
      },
    ),
    revokedReason: text('revoked_reason'),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    userAgent: text('user_agent'),
    ipAddress: varchar('ip_address', { length: 64 }),
  },
  (table) => ({
    refreshTokensJtiUniqueIdx: uniqueIndex('refresh_tokens_jti_unique_idx').on(
      table.jti,
    ),
    refreshTokensSessionIdIdx: index('refresh_tokens_session_id_idx').on(
      table.sessionId,
    ),
    refreshTokensExpiresAtIdx: index('refresh_tokens_expires_at_idx').on(
      table.expiresAt,
    ),
    refreshTokensSessionIdExpiresAtIdx: index(
      'refresh_tokens_session_id_expires_at_idx',
    ).on(table.sessionId, table.expiresAt),
  }),
)

export type RefreshTokenRow = typeof refreshTokens.$inferSelect
export type NewRefreshTokenRow = typeof refreshTokens.$inferInsert
