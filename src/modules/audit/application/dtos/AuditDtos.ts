import type { AuthAuditEventStatus } from '../../domain/services/IAuthAuditService.js'

export interface AuditLogItemDto {
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
  createdAt: string
}

export interface AuditLogsPaginationDto {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface ListAuditLogsInputDto {
  page: number
  limit: number
  userId?: string
  actorUserId?: string
  requestId?: string
  eventType?: string
  eventStatus?: AuthAuditEventStatus
  from?: Date
  to?: Date
}

export interface ListAuditLogsResultDto {
  logs: AuditLogItemDto[]
  pagination: AuditLogsPaginationDto
}
