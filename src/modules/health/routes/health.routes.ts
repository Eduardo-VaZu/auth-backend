import { Router } from 'express'
import type { Container } from 'inversify'

import { TYPES } from '../../../container/types.js'
import type { HealthController } from '../HealthController.js'

export const createHealthRouter = (container: Container): Router => {
  const router = Router()
  const controller = container.get<HealthController>(TYPES.HealthController)

  router.get('/', (request, response, next) => {
    controller.getStatus(request, response).catch(next)
  })

  return router
}
