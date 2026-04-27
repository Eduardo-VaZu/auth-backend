import type { Container } from 'inversify'

import { TYPES } from '../../container/types.js'
import type { IAuthAuditService } from './domain/services/IAuthAuditService.js'
import { AuthAuditService } from './infrastructure/services/AuthAuditService.js'

export const configureAuditModule = (container: Container): void => {
  container.bind<IAuthAuditService>(TYPES.IAuthAuditService).to(AuthAuditService)
}
