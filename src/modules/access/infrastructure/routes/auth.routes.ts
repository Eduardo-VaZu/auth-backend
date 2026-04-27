import { Router } from 'express'
import type { Container } from 'inversify'

import { TYPES } from '../../../../container/types.js'
import { createAuthenticate } from '../../../../shared/middlewares/authenticate.js'
import { validateBody } from '../../../../shared/middlewares/validateBody.js'
import type { IUserSessionRepository } from '../../domain/repositories/IUserSessionRepository.js'
import type { ISessionStore } from '../../domain/services/ISessionStore.js'
import type { ITokenService } from '../../domain/services/ITokenService.js'
import type { AccessController } from '../controllers/AccessController.js'
import { loginSchema } from './auth.schemas.js'

export const createAuthRouter = (container: Container): Router => {
  const router = Router()
  const controller = container.get<AccessController>(TYPES.AccessController)
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

  router.post(
    '/login',
    validateBody(loginSchema),
    (request, response, next) => {
      controller.login(request, response).catch(next)
    },
  )

  router.post('/refresh', (request, response, next) => {
    controller.refresh(request, response).catch(next)
  })

  router.post('/logout', authenticate, (request, response, next) => {
    controller.logout(request, response).catch(next)
  })

  router.post('/logout-all', authenticate, (request, response, next) => {
    controller.logoutAll(request, response).catch(next)
  })

  return router
}
