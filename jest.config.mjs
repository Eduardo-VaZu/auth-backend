/** @type {import('ts-jest').JestConfigWithTsJest} */
const baseProjectConfig = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  cacheDirectory: '<rootDir>/.jest-cache',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
}

const config = {
  verbose: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main/**',
    '!src/config/**',
    '!src/types/**',
    '!src/infrastructure/db/migrations/**',
  ],
  coverageThreshold: {
    global: {
      branches: 40,
      functions: 40,
      lines: 45,
      statements: 45,
    },
    './src/modules/identity/domain/**': {
      branches: 90,
      functions: 90,
      lines: 90,
    },
    './src/modules/access/domain/**': {
      branches: 90,
      functions: 90,
      lines: 90,
    },
  },
  projects: [
    {
      ...baseProjectConfig,
      displayName: 'unit',
      roots: ['<rootDir>/tests'],
      testMatch: ['**/unit/**/*.test.ts'],
    },
    {
      ...baseProjectConfig,
      displayName: 'integration',
      roots: ['<rootDir>/tests'],
      testMatch: ['**/integration/**/*.test.ts'],
    },
  ],
}

export default config
