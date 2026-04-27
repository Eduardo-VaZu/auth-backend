import { Router } from 'express'
import type { Container } from 'inversify'

import { TYPES } from '../../../../container/types.js'
import { createAuthenticate } from '../../../../shared/middlewares/authenticate.js'
import { validateBody } from '../../../../shared/middlewares/validateBody.js'
import type { IUserSessionRepository } from '../../domain/repositories/IUserSessionRepository.js'
import type { ISessionStore } from '../../domain/services/ISessionStore.js'
import type { ITokenService } from '../../domain/services/ITokenService.js'
import type { AuthController } from '../controllers/AuthController.js'
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
} from './auth.schemas.js'

export const createAuthRouter = (container: Container): Router => {
  const router = Router()
  const controller = container.get<AuthController>(TYPES.AuthController)
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
    '/register',
    validateBody(registerSchema),
    (request, response, next) => {
      controller.register(request, response).catch(next)
    },
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

  router.post(
    '/change-password',
    authenticate,
    validateBody(changePasswordSchema),
    (request, response, next) => {
      controller.changePassword(request, response).catch(next)
    },
  )

  router.get('/me', authenticate, (request, response, next) => {
    controller.me(request, response).catch(next)
  })

  return router
}
