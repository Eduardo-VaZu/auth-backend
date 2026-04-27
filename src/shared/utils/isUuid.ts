import type { Logger } from 'pino'

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const isUuid = (value: string): boolean => uuidRegex.test(value)

interface InvalidUuidLogContext {
  logger: Logger
  component: string
  field: string
  value: string | null | undefined
}

export const logInvalidUuidDiscard = ({
  logger,
  component,
  field,
  value,
}: InvalidUuidLogContext): void => {
  if (value === null || value === undefined || isUuid(value)) {
    return
  }

  logger.warn(
    {
      level: 'warn',
      event: 'invalid_uuid_discarded',
      component,
      field,
      valueLength: value.length,
      preview: value.slice(0, 8),
    },
    'Invalid UUID discarded',
  )
}

export const coerceUuidOrNull = (
  value: string | null | undefined,
): string | null => {
  if (value === null || value === undefined) {
    return null
  }

  return isUuid(value) ? value : null
}
