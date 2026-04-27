import { defineConfig } from 'drizzle-kit'

import { env } from './src/config/env.ts'

export default defineConfig({
  out: './drizzle',
  schema: './dist/infrastructure/db/schema/index.js',
  dialect: 'postgresql',
  dbCredentials: {
    url: env.DATABASE_URL,
  },
  strict: true,
  verbose: true,
})
