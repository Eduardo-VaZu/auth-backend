import { ValidationError } from '../../../../shared/errors/ValidationError.js'

const UNIT_TO_SECONDS = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 60 * 60 * 24,
} as const

export const durationToSeconds = (
  value: string,
  field = 'duration',
): number => {
  const match = /^(?<amount>\d+)(?<unit>[smhd])$/iu.exec(value.trim())

  if (match?.groups === undefined) {
    throw new ValidationError([
      {
        field,
        message: 'Duration must use the format <number><s|m|h|d>',
      },
    ])
  }

  const amount = Number(match.groups.amount)
  const unitGroup = match.groups.unit

  if (unitGroup === undefined) {
    throw new ValidationError([
      {
        field,
        message: 'Duration unit is required',
      },
    ])
  }

  const unit = unitGroup.toLowerCase() as keyof typeof UNIT_TO_SECONDS

  return amount * UNIT_TO_SECONDS[unit]
}
