import { Router } from 'express'
import type { Container } from 'inversify'

import { TYPES } from '../../../../container/types.js'
import { validateBody } from '../../../../shared/middlewares/validateBody.js'
import { createAuthenticate } from '../../../../shared/middlewares/authenticate.js'
import type { IdentityController } from '../controllers/IdentityController.js'
import { registerSchema } from '../../../access/infrastructure/routes/auth.schemas.js' // Usando schemas existentes temporalmente
import type { ITokenService } from '../../../access/domain/services/ITokenService.js'
import type { ISessionStore } from '../../../access/domain/services/ISessionStore.js'
import type { IUserSessionRepository } from '../../../access/domain/repositories/IUserSessionRepository.js'

export const createIdentityRouter = (container: Container): Router => {
  const router = Router()
  const controller = container.get<IdentityController>(TYPES.IdentityController)
  
  // Dependencias para authenticate (Shared)
  const tokenService = container.get<ITokenService>(TYPES.ITokenService)
  const sessionStore = container.get<ISessionStore>(TYPES.ISessionStore)
  const userSessionRepository = container.get<IUserSessionRepository>(TYPES.IUserSessionRepository)
  const authenticate = createAuthenticate(tokenService, sessionStore, userSessionRepository)

  router.post(
    '/register',
    validateBody(registerSchema),
    (request, response, next) => {
      controller.register(request, response).catch(next)
    },
  )

  router.get('/me', authenticate, (request, response, next) => {
    controller.me(request, response).catch(next)
  })

  return router
}
