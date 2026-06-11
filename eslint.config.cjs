const tseslint = require('@typescript-eslint/eslint-plugin')
const tsParser = require('@typescript-eslint/parser')

const eslintRecommendedForTypescript =
  tseslint.configs['eslint-recommended'].overrides[0].rules
const recommendedTypescriptRules = tseslint.configs.recommended.rules
const recommendedTypeCheckedRules =
  tseslint.configs['recommended-requiring-type-checking'].rules

module.exports = [
  {
    ignores: [
      'dist/',
      'drizzle/',
      'coverage/',
      'node_modules/',
      'docs/test-report-ui/',
      'scripts/',
      'vitest.config.mts',
      'eslint.config.cjs',
    ],
  },
  {
    files: ['**/*.ts', '**/*.d.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: __dirname,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
  },
  {
    files: ['**/*.ts', '**/*.d.ts'],
    rules: {
      ...eslintRecommendedForTypescript,
      ...recommendedTypescriptRules,
      ...recommendedTypeCheckedRules,
      'no-console': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },
  {
    files: ['**/__tests__/**/*.ts', 'tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
]
