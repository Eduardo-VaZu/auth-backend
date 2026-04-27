import 'reflect-metadata'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express, { type Express } from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import type { Container } from 'inversify'
import type { Logger } from 'pino'
import { RedisStore } from 'rate-limit-redis'

import { env } from './config/env.js'
import { TYPES } from './container/types.js'
import type { AppRedisClient } from './infrastructure/redis.js'
import { createAuthRouter } from './modules/auth/infrastructure/routes/auth.routes.js'
import { createHealthRouter } from './modules/health/routes/health.routes.js'
import {
  TooManyRequestsError,
  NotFoundError,
} from './shared/errors/HttpErrors.js'
import { createErrorHandler } from './shared/middlewares/errorHandler.js'
import { createRequestLogger } from './shared/middlewares/requestLogger.js'

type RedisStoreReply =
  | boolean
  | number
  | string
  | Array<boolean | number | string>

const createRateLimiter = (redisClient: AppRedisClient) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
      prefix: 'rate-limit:',
      sendCommand: (...command: string[]): Promise<RedisStoreReply> =>
        redisClient.sendCommand(command),
    }),
    handler: (_request, _response, next) => {
      next(new TooManyRequestsError())
    },
  })

export const createApp = (container: Container): Express => {
  const app = express()
  const logger = container.get<Logger>(TYPES.Logger)
  const redisClient = container.get<AppRedisClient>(TYPES.RedisClient)

  app.disable('x-powered-by')
  app.set('trust proxy', env.TRUST_PROXY)
  app.use(createRequestLogger(logger))
  app.use('/health', createHealthRouter(container))
  app.use(express.json({ limit: '10kb' }))
  app.use(
    cors({
      origin: (origin, callback) => {
        // En desarrollo, permitir requests sin origen (como Postman o curl)
        if (!origin || env.CORS_ORIGIN.includes(origin)) {
          callback(null, true)
        } else {
          callback(new Error('Not allowed by CORS'))
        }
      },
      credentials: true,
    }),
  )
  app.use(helmet())
  app.use(cookieParser(env.COOKIE_SECRET))
  app.use(createRateLimiter(redisClient))

  app.use('/auth', createAuthRouter(container))

  app.use((_request, _response, next) => {
    next(new NotFoundError('Route not found'))
  })

  app.use(createErrorHandler(logger))

  return app
}
