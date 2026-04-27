export type AuthAuditEventStatus =
  | 'success'
  | 'failure'
  | 'blocked'
  | 'incident'

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
}
