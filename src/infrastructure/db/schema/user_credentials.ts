import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

import { users } from './users.js'

export const userCredentials = pgTable(
  'user_credentials',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, {
        onDelete: 'cascade',
      }),
    passwordHash: text('password_hash').notNull(),
    passwordChangedAt: timestamp('password_changed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    passwordVersion: integer('password_version').notNull().default(1),
    mustChangePassword: boolean('must_change_password')
      .notNull()
      .default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userCredentialsUserIdUniqueIdx: uniqueIndex(
      'user_credentials_user_id_unique_idx',
    ).on(table.userId),
  }),
)

export type UserCredentialRow = typeof userCredentials.$inferSelect
export type NewUserCredentialRow = typeof userCredentials.$inferInsert
