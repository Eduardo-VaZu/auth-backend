#!/usr/bin/env node

import { execSync } from 'node:child_process'

const stdout = (line) => process.stdout.write(`${line}\n`)

try {
  execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' })
} catch {
  stdout(
    '[hooks:install] Not a git repository in this workspace. Skipping hook install.',
  )
  process.exit(0)
}

execSync('git config core.hooksPath .githooks', { stdio: 'inherit' })
stdout('[hooks:install] Installed hooks path: .githooks')
