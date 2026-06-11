export interface TestSummary {
  total: number
  passed: number
  failed: number
  pending: number
  running: number
}

export interface TestCommand {
  id: string
  label: string
  command: string
  status: 'passed' | 'failed' | 'pending' | 'running'
  summary: string
  details: string[]
  stdout: string
  stderr: string
  lastUpdatedAt: string
}

export interface TestCase {
  id: string
  file: string
  module: string
  type: 'unit' | 'integration'
  caseName: string
  status: 'passed' | 'failed' | 'pending' | 'running'
  summary: string
  details: string[]
  stdout: string
  stderr: string
  lastUpdatedAt: string
  command: string
}

export interface CoverageRow {
  file: string
  statements: string
  branches: string
  functions: string
  lines: string
  uncovered: string
  resolvedPath?: string
  displayLabel?: string
}

export interface CoverageData {
  rows: CoverageRow[]
  summary: {
    statements?: string
    branches?: string
    functions?: string
    lines?: string
  }
  glossary: {
    statements: string
    branches: string
    functions: string
    lines: string
    uncovered: string
  }
}

export interface Highlight {
  title: string
  tone: 'ok' | 'warn' | 'info'
  body: string
}

export interface TestReportData {
  generatedAt: string
  runState: string
  summary: TestSummary
  commands: TestCommand[]
  tests: TestCase[]
  coverage: CoverageData
  highlights: Highlight[]
}
