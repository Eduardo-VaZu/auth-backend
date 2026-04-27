import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

import { users } from './users.js'

export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, {
        onDelete: 'cascade',
      }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    requestedByIp: varchar('requested_by_ip', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    passwordResetTokensUserIdIdx: index('password_reset_tokens_user_id_idx').on(
      table.userId,
    ),
    passwordResetTokensUserIdExpiresAtIdx: index(
      'password_reset_tokens_user_id_expires_at_idx',
    ).on(table.userId, table.expiresAt),
  }),
)

export type PasswordResetTokenRow = typeof passwordResetTokens.$inferSelect
export type NewPasswordResetTokenRow = typeof passwordResetTokens.$inferInsert
