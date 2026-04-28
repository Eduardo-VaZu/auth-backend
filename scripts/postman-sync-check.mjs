#!/usr/bin/env node

import 'dotenv/config'

const BASE_URL = process.env.POSTMAN_BASE_URL ?? 'https://api.getpostman.com'
const API_KEY = process.env.POSTMAN_API_KEY
const SPEC_ID =
  process.env.POSTMAN_SPEC_ID ?? '1210b2ab-b12d-4a19-b1d5-cbf28da6eec2'
const COLLECTION_UID =
  process.env.POSTMAN_COLLECTION_UID ??
  '42700275-5823a8cb-3329-4126-9fdc-6fb5e57cfd90'

const stdout = (line) => process.stdout.write(`${line}\n`)
const stderr = (line) => process.stderr.write(`${line}\n`)

if (!API_KEY) {
  stderr('[postman-sync-check] Missing env var: POSTMAN_API_KEY')
  process.exit(1)
}

const toJson = async (response) => {
  const text = await response.text()
  if (!text) {
    return {}
  }
  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}

const request = async (path) => {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'GET',
    headers: {
      'X-Api-Key': API_KEY,
      'Content-Type': 'application/json',
    },
  })

  const payload = await toJson(response)
  if (!response.ok) {
    const detail =
      payload?.detail ??
      payload?.error?.message ??
      payload?.raw ??
      'Request failed'
    throw new Error(
      `[postman-sync-check] GET ${path} failed (${response.status}): ${detail}`,
    )
  }
  return payload
}

const main = async () => {
  const path = `/specs/${encodeURIComponent(SPEC_ID)}/generations/collection`
  const payload = await request(path)
  const collections = Array.isArray(payload?.collections)
    ? payload.collections
    : []

  const target = collections.find((item) => item?.id === COLLECTION_UID)
  if (!target) {
    throw new Error(
      `[postman-sync-check] Collection ${COLLECTION_UID} is not linked to spec ${SPEC_ID}.`,
    )
  }

  const state = String(target.state ?? '').toLowerCase()
  if (state === 'in-sync') {
    stdout(`[postman-sync-check] OK: collection is in-sync (spec=${SPEC_ID}).`)
    return
  }

  if (state === 'out-of-sync') {
    throw new Error(
      `[postman-sync-check] OUT-OF-SYNC: run "npm run postman:sync" before push/PR close.`,
    )
  }

  throw new Error(
    `[postman-sync-check] Unexpected state "${target.state ?? 'unknown'}".`,
  )
}

try {
  await main()
} catch (error) {
  stderr(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
