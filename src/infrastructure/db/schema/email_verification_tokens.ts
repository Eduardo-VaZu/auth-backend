import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import { users } from './users.js'

export const emailVerificationTokens = pgTable(
  'email_verification_tokens',
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
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    emailVerificationTokensUserIdIdx: index(
      'email_verification_tokens_user_id_idx',
    ).on(table.userId),
    emailVerificationTokensUserIdExpiresAtIdx: index(
      'email_verification_tokens_user_id_expires_at_idx',
    ).on(table.userId, table.expiresAt),
  }),
)

export type EmailVerificationTokenRow =
  typeof emailVerificationTokens.$inferSelect
export type NewEmailVerificationTokenRow =
  typeof emailVerificationTokens.$inferInsert
