import { readFileSync } from 'node:fs'

import pino, {
  type Logger,
  type LoggerOptions,
  type TransportSingleOptions,
} from 'pino'

import { env } from '../../config/env.js'

interface PackageMetadata {
  version: string
}

const packageMetadata = JSON.parse(
  readFileSync(new URL('../../../package.json', import.meta.url), 'utf-8'),
) as PackageMetadata

const transport =
  env.NODE_ENV === 'development'
    ? ({
        target: 'pino-pretty',
        options: {
          colorize: true,
          singleLine: true,
          translateTime: 'SYS:standard',
        },
      } satisfies TransportSingleOptions)
    : undefined

export const createLogger = (): Logger =>
  pino({
    level: env.NODE_ENV === 'development' ? 'debug' : 'info',
    base: {
      service: 'auth-backend',
      env: env.NODE_ENV,
      version: packageMetadata.version,
    },
    ...(transport === undefined ? {} : { transport }),
  } satisfies LoggerOptions)

export const appLogger: Logger = createLogger()
