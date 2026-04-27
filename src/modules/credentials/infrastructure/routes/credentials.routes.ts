import { Router } from 'express'
import type { Container } from 'inversify'

import { TYPES } from '../../../../container/types.js'
import { validateBody } from '../../../../shared/middlewares/validateBody.js'
import { createAuthenticate } from '../../../../shared/middlewares/authenticate.js'
import type { CredentialsController } from '../controllers/CredentialsController.js'
import {
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '../../../access/infrastructure/routes/auth.schemas.js'
import type { ITokenService } from '../../../access/domain/services/ITokenService.js'
import type { ISessionStore } from '../../../access/domain/services/ISessionStore.js'
import type { IUserSessionRepository } from '../../../access/domain/repositories/IUserSessionRepository.js'

export const createCredentialsRouter = (container: Container): Router => {
  const router = Router()
  const controller = container.get<CredentialsController>(TYPES.CredentialsController)
  
  const tokenService = container.get<ITokenService>(TYPES.ITokenService)
  const sessionStore = container.get<ISessionStore>(TYPES.ISessionStore)
  const userSessionRepository = container.get<IUserSessionRepository>(TYPES.IUserSessionRepository)
  const authenticate = createAuthenticate(tokenService, sessionStore, userSessionRepository)

  router.post(
    '/forgot-password',
    validateBody(forgotPasswordSchema),
    (request, response, next) => {
      Promise.resolve(controller.forgotPassword(request, response)).catch(next)
    },
  )

  router.post(
    '/reset-password',
    validateBody(resetPasswordSchema),
    (request, response, next) => {
      Promise.resolve(controller.resetPassword(request, response)).catch(next)
    },
  )

  router.post(
    '/verify-email',
    validateBody(verifyEmailSchema),
    (request, response, next) => {
      Promise.resolve(controller.verifyEmail(request, response)).catch(next)
    },
  )

  router.post('/resend-verification', authenticate, (request, response, next) => {
    Promise.resolve(controller.resendVerification(request, response)).catch(next)
  })

  router.post(
    '/change-password',
    authenticate,
    validateBody(changePasswordSchema),
    (request, response, next) => {
      Promise.resolve(controller.changePassword(request, response)).catch(next)
    },
  )

  return router
}
