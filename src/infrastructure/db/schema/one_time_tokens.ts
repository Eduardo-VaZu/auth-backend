import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

import { users } from './users.js'

export const oneTimeTokens = pgTable(
  'one_time_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, {
        onDelete: 'cascade',
      }),
    type: varchar('type', { length: 64 }).notNull(),
    tokenHash: text('token_hash').notNull(),
    requestedByIp: varchar('requested_by_ip', { length: 64 }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    oneTimeTokensUserIdIdx: index('one_time_tokens_user_id_idx').on(
      table.userId,
    ),
    oneTimeTokensUserIdTypeIdx: index('one_time_tokens_user_id_type_idx').on(
      table.userId,
      table.type,
    ),
    oneTimeTokensTypeExpiresAtIdx: index(
      'one_time_tokens_type_expires_at_idx',
    ).on(table.type, table.expiresAt),
  }),
)

export type OneTimeTokenRow = typeof oneTimeTokens.$inferSelect
export type NewOneTimeTokenRow = typeof oneTimeTokens.$inferInsert
