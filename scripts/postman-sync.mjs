#!/usr/bin/env node

import 'dotenv/config'
import { readFile } from 'node:fs/promises'

const BASE_URL = process.env.POSTMAN_BASE_URL ?? 'https://api.getpostman.com'
const API_KEY = process.env.POSTMAN_API_KEY
const SPEC_ID =
  process.env.POSTMAN_SPEC_ID ?? '1210b2ab-b12d-4a19-b1d5-cbf28da6eec2'
const COLLECTION_UID =
  process.env.POSTMAN_COLLECTION_UID ??
  '42700275-5823a8cb-3329-4126-9fdc-6fb5e57cfd90'
const SPEC_FILE =
  process.env.POSTMAN_SPEC_FILE ?? 'docs/openapi/auth-backend.v1.yaml'
const SPEC_REMOTE_PATH = process.env.POSTMAN_SPEC_REMOTE_PATH ?? 'index.yaml'
const POLL_INTERVAL_MS = Number.parseInt(
  process.env.POSTMAN_TASK_POLL_MS ?? '2000',
  10,
)
const TIMEOUT_MS = Number.parseInt(
  process.env.POSTMAN_TASK_TIMEOUT_MS ?? '90000',
  10,
)

const stdout = (line) => process.stdout.write(`${line}\n`)
const stderr = (line) => process.stderr.write(`${line}\n`)

const required = [
  { name: 'POSTMAN_API_KEY', value: API_KEY },
  { name: 'POSTMAN_SPEC_ID', value: SPEC_ID },
  { name: 'POSTMAN_COLLECTION_UID', value: COLLECTION_UID },
]

const missing = required.filter((item) => !item.value).map((item) => item.name)
if (missing.length > 0) {
  stderr(`[postman-sync] Missing env vars: ${missing.join(', ')}`)
  process.exit(1)
}

const wait = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

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

const request = async (method, path, body) => {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'X-Api-Key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const payload = await toJson(response)

  if (!response.ok) {
    const detail =
      payload?.detail ??
      payload?.error?.message ??
      payload?.raw ??
      'Request failed'
    const message = `[postman-sync] ${method} ${path} failed (${response.status}): ${detail}`
    const error = new Error(message)
    error.payload = payload
    error.status = response.status
    throw error
  }

  return payload
}

const syncOrIgnoreAlreadyInSync = async () => {
  const path = `/collections/${encodeURIComponent(COLLECTION_UID)}/synchronizations?specId=${encodeURIComponent(SPEC_ID)}`
  try {
    return await request('PUT', path)
  } catch (error) {
    const detail = error?.payload?.detail
    if (
      error?.status === 400 &&
      typeof detail === 'string' &&
      detail.includes('already in sync')
    ) {
      stdout('[postman-sync] Collection already in sync.')
      return null
    }
    throw error
  }
}

const encodeFilePath = (value) =>
  value.split('/').map(encodeURIComponent).join('/')

const pollTask = async (taskUrl) => {
  const deadline = Date.now() + TIMEOUT_MS
  while (Date.now() <= deadline) {
    const task = await request('GET', taskUrl)
    const status = String(task?.status ?? '').toLowerCase()

    if (status === 'completed') {
      stdout('[postman-sync] Sync task completed.')
      return task
    }
    if (status === 'failed') {
      const details = task?.details
        ? JSON.stringify(task.details)
        : 'unknown reason'
      throw new Error(`[postman-sync] Sync task failed: ${details}`)
    }

    stdout(`[postman-sync] Task status: ${status || 'pending'}...`)
    await wait(POLL_INTERVAL_MS)
  }

  throw new Error(
    `[postman-sync] Timeout waiting for task completion (${TIMEOUT_MS} ms).`,
  )
}

const main = async () => {
  stdout(`[postman-sync] Reading ${SPEC_FILE}`)
  const content = await readFile(SPEC_FILE, 'utf8')

  const filePath = encodeFilePath(SPEC_REMOTE_PATH)
  stdout(
    `[postman-sync] Updating spec file ${SPEC_REMOTE_PATH} on spec ${SPEC_ID}`,
  )
  await request(
    'PATCH',
    `/specs/${encodeURIComponent(SPEC_ID)}/files/${filePath}`,
    { content },
  )

  stdout(
    `[postman-sync] Syncing collection ${COLLECTION_UID} from spec ${SPEC_ID}`,
  )
  const syncResult = await syncOrIgnoreAlreadyInSync()

  if (syncResult?.url) {
    await pollTask(syncResult.url)
  }

  stdout('[postman-sync] Done.')
}

try {
  await main()
} catch (error) {
  stderr(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
