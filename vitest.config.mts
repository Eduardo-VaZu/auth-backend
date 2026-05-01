import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = dirname(fileURLToPath(import.meta.url))

export default {
  resolve: {
    alias: {
      '@': resolve(rootDir, 'src'),
    },
  },
  test: {
    clearMocks: true,
    pool: 'threads',
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/main/**',
        'src/config/**',
        'src/types/**',
        'src/infrastructure/db/migrations/**',
      ],
      thresholds: {
        branches: 40,
        functions: 40,
        lines: 45,
        statements: 45,
        'src/modules/identity/domain/**': {
          branches: 90,
          functions: 90,
          lines: 90,
        },
        'src/modules/access/domain/**': {
          branches: 90,
          functions: 90,
          lines: 90,
        },
      },
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/**/unit/**/*.test.ts'],
          setupFiles: ['./tests/setup.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          environment: 'node',
          include: ['tests/**/integration/**/*.test.ts'],
          setupFiles: ['./tests/setup.ts'],
          fileParallelism: false,
          hookTimeout: 120000,
          testTimeout: 120000,
        },
      },
    ],
  },
}
