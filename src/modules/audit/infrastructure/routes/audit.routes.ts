import { Router, type RequestHandler } from 'express'
import type { Container } from 'inversify'

import { TYPES } from '../../../../container/types.js'
import type { IUserSessionRepository } from '../../../access/domain/repositories/IUserSessionRepository.js'
import type { ISessionStore } from '../../../access/domain/services/ISessionStore.js'
import type { ITokenService } from '../../../access/domain/services/ITokenService.js'
import { createAuthenticate } from '../../../../shared/middlewares/authenticate.js'
import { ForbiddenError } from '../../../../shared/errors/HttpErrors.js'
import type { AuditController } from '../controllers/AuditController.js'

const requireAdmin: RequestHandler = (request, _response, next) => {
  if (request.user?.roles.includes('admin') !== true) {
    next(new ForbiddenError('Admin role required'))
    return
  }

  next()
}

export const createAuditRouter = (container: Container): Router => {
  const router = Router()
  const controller = container.get<AuditController>(TYPES.AuditController)
  const tokenService = container.get<ITokenService>(TYPES.ITokenService)
  const sessionStore = container.get<ISessionStore>(TYPES.ISessionStore)
  const userSessionRepository = container.get<IUserSessionRepository>(
    TYPES.IUserSessionRepository,
  )
  const authenticate = createAuthenticate(
    tokenService,
    sessionStore,
    userSessionRepository,
  )

  router.use(authenticate, requireAdmin)

  router.get('/audit-logs', (request, response, next) => {
    Promise.resolve(controller.listLogs(request, response)).catch(next)
  })

  return router
}
