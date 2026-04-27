import { sql } from 'drizzle-orm'
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

import { userSessions } from './user_sessions.js'
import { users } from './users.js'

export const authAuditLogs = pgTable(
  'auth_audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    actorUserId: uuid('actor_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    sessionId: uuid('session_id').references(() => userSessions.id, {
      onDelete: 'set null',
    }),
    eventType: varchar('event_type', { length: 128 }).notNull(),
    eventStatus: varchar('event_status', { length: 32 }).notNull(),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: varchar('user_agent', { length: 1024 }),
    requestId: uuid('request_id'),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    authAuditLogsCreatedAtIdx: index('auth_audit_logs_created_at_idx').on(
      table.createdAt,
    ),
    authAuditLogsRequestIdIdx: index('auth_audit_logs_request_id_idx').on(
      table.requestId,
    ),
    authAuditLogsUserIdIdx: index('auth_audit_logs_user_id_idx').on(
      table.userId,
    ),
    authAuditLogsEventTypeIdx: index('auth_audit_logs_event_type_idx').on(
      table.eventType,
    ),
    authAuditLogsEventStatusIdx: index('auth_audit_logs_event_status_idx').on(
      table.eventStatus,
    ),
    authAuditLogsSessionIdIdx: index('auth_audit_logs_session_id_idx').on(
      table.sessionId,
    ),
    authAuditLogsActorUserIdIdx: index('auth_audit_logs_actor_user_id_idx').on(
      table.actorUserId,
    ),
  }),
)

export type AuthAuditLogRow = typeof authAuditLogs.$inferSelect
export type NewAuthAuditLogRow = typeof authAuditLogs.$inferInsert
