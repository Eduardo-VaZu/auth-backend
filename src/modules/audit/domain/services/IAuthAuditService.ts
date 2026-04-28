export type AuthAuditEventStatus =
  | 'success'
  | 'failure'
  | 'blocked'
  | 'incident'

export interface AuthAuditEvent {
  id: string
  userId: string | null
  actorUserId: string | null
  sessionId: string | null
  roleId: string | null
  eventType: string
  eventStatus: AuthAuditEventStatus
  ipAddress: string | null
  userAgent: string | null
  requestId: string | null
  metadata: Record<string, unknown>
  createdAt: Date
}

export interface ListAuthAuditEventsParams {
  limit: number
  offset: number
  userId?: string
  actorUserId?: string
  requestId?: string
  eventType?: string
  eventStatus?: AuthAuditEventStatus
  createdFrom?: Date
  createdTo?: Date
}

export interface ListAuthAuditEventsResult {
  events: AuthAuditEvent[]
  total: number
}

export interface RecordAuthAuditEventParams {
  userId: string | null
  actorUserId?: string | null
  sessionId?: string | null
  roleId?: string | null
  eventType: string
  eventStatus: AuthAuditEventStatus
  ipAddress: string | null
  userAgent: string | null
  requestId: string | null
  metadata?: Record<string, unknown>
}

export interface IAuthAuditService {
  recordEvent(params: RecordAuthAuditEventParams): Promise<void>
  listEvents(
    params: ListAuthAuditEventsParams,
  ): Promise<ListAuthAuditEventsResult>
}
