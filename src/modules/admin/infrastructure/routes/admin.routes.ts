import { Router, type RequestHandler } from 'express'
import type { Container } from 'inversify'

import { TYPES } from '../../../../container/types.js'
import type { IUserSessionRepository } from '../../../access/domain/repositories/IUserSessionRepository.js'
import type { ISessionStore } from '../../../access/domain/services/ISessionStore.js'
import type { ITokenService } from '../../../access/domain/services/ITokenService.js'
import { createAuthenticate } from '../../../../shared/middlewares/authenticate.js'
import { ForbiddenError } from '../../../../shared/errors/HttpErrors.js'
import { validateBody } from '../../../../shared/middlewares/validateBody.js'
import type { AdminController } from '../controllers/AdminController.js'
import { assignUserRoleSchema } from './admin.schemas.js'

const requireAdmin: RequestHandler = (request, _response, next) => {
  if (request.user?.roles.includes('admin') !== true) {
    next(new ForbiddenError('Admin role required'))
    return
  }

  next()
}

export const createAdminRouter = (container: Container): Router => {
  const router = Router()
  const controller = container.get<AdminController>(TYPES.AdminController)
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

  router.get('/roles', (request, response, next) => {
    Promise.resolve(controller.listRoles(request, response)).catch(next)
  })

  router.get('/users/:userId/roles', (request, response, next) => {
    Promise.resolve(controller.listUserRoles(request, response)).catch(next)
  })

  router.post(
    '/users/:userId/roles',
    validateBody(assignUserRoleSchema),
    (request, response, next) => {
      Promise.resolve(controller.assignUserRole(request, response)).catch(next)
    },
  )

  router.delete('/users/:userId/roles/:roleId', (request, response, next) => {
    Promise.resolve(controller.revokeUserRole(request, response)).catch(next)
  })

  return router
}
