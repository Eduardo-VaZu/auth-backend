import type { Container } from 'inversify'

import { TYPES } from '../../container/types.js'
import { ListAuditLogsUseCase } from './application/use-cases/ListAuditLogsUseCase.js'
import type { IAuthAuditService } from './domain/services/IAuthAuditService.js'
import { AuditController } from './infrastructure/controllers/AuditController.js'
import { AuthAuditService } from './infrastructure/services/AuthAuditService.js'

export const configureAuditModule = (container: Container): void => {
  container
    .bind<IAuthAuditService>(TYPES.IAuthAuditService)
    .to(AuthAuditService)
  container
    .bind<ListAuditLogsUseCase>(TYPES.ListAuditLogsUseCase)
    .to(ListAuditLogsUseCase)
  container.bind<AuditController>(TYPES.AuditController).to(AuditController)
}
