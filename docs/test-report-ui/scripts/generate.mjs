import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const projectRoot = process.cwd()
const testsRoot = path.join(projectRoot, 'tests')
const sourceRoot = path.join(projectRoot, 'src')
const outputPath = path.join(
  projectRoot,
  'docs',
  'test-report-ui',
  'public',
  'data.js',
)
const coverageLcovPath = path.join(projectRoot, 'coverage', 'lcov.info')

const COVERAGE_COMMAND = ['npm.cmd', ['run', 'test:coverage']]
const TYPECHECK_COMMAND = ['npm.cmd', ['run', 'type:check']]

const COVERAGE_GLOSSARY = {
  statements:
    'Porcentaje de instrucciones del codigo ejecutadas por las pruebas.',
  branches:
    'Porcentaje de caminos condicionales cubiertos, por ejemplo if/else o ternarios.',
  functions: 'Porcentaje de funciones o metodos ejecutados al menos una vez.',
  lines: 'Porcentaje de lineas ejecutadas durante la corrida.',
  uncovered:
    'Lineas o rangos que no fueron cubiertos por las pruebas segun el reporte.',
}

const badgeStatusByExitCode = (code) => (code === 0 ? 'passed' : 'failed')

const toPosixPath = (value) => value.split(path.sep).join('/')

const formatTimestamp = () => new Date().toISOString()

const walk = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        return walk(fullPath)
      }
      if (entry.isFile() && entry.name.endsWith('.test.ts')) {
        return [fullPath]
      }
      return []
    }),
  )

  return files.flat()
}

const walkSourceFiles = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        return walkSourceFiles(fullPath)
      }
      if (entry.isFile()) {
        return [fullPath]
      }
      return []
    }),
  )

  return files.flat()
}

const escapeHtml = (value) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

const inferProjectType = (relativePath) =>
  relativePath.includes('/integration/') ? 'integration' : 'unit'

const inferModule = (relativePath) => {
  const normalized = relativePath.toLowerCase()

  if (normalized.includes('/health/')) return 'health'
  if (normalized.includes('/identity/')) return 'identity'
  if (normalized.includes('/access/')) return 'access'
  if (normalized.includes('/credentials/')) return 'credentials'
  if (normalized.includes('/admin/')) return 'admin'
  if (normalized.includes('/audit/')) return 'audit'
  if (normalized.includes('/infra/')) return 'infra'

  return 'shared'
}

const inferCaseName = (relativePath) =>
  path
    .basename(relativePath, '.test.ts')
    .replaceAll(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replaceAll('.', ' ')

const extractSummary = (stdout, stderr, fallbackStatus) => {
  const combined = `${stdout}\n${stderr}`.trim()
  const lines = combined
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const testsLine = lines.find((line) => /^Tests\b/i.test(line))
  const filesLine = lines.find((line) => /^Test Files\b/i.test(line))
  const durationLine = lines.find((line) => /^Duration\b/i.test(line))
  const errorLine =
    lines.find((line) => /Error:/i.test(line)) ||
    lines.find((line) => /FAIL\b/i.test(line))

  return {
    short:
      testsLine ||
      filesLine ||
      errorLine ||
      (fallbackStatus === 'passed' ? 'Comando aprobado' : 'Comando fallido'),
    details: [filesLine, testsLine, durationLine, errorLine].filter(Boolean),
  }
}

const normalizeOutput = (value) => {
  const trimmed = (value || '').trim()
  return trimmed.length > 0 ? trimmed : ''
}

const parseCoverageData = (stdout, stderr) => {
  const text = `${stdout || ''}\n${stderr || ''}`
  const lines = text.split(/\r?\n/)
  const tableHeaderIndex = lines.findIndex(
    (line) =>
      line.includes('File') &&
      line.includes('% Stmts') &&
      line.includes('% Branch') &&
      line.includes('% Funcs') &&
      line.includes('% Lines'),
  )

  const rows = []
  if (tableHeaderIndex !== -1) {
    for (let index = tableHeaderIndex + 2; index < lines.length; index += 1) {
      const line = lines[index]
      if (
        !line ||
        line.startsWith('=============================== Coverage summary') ||
        line.startsWith(
          '================================================================================',
        )
      ) {
        break
      }
      if (!line.includes('|') || line.startsWith('---')) {
        continue
      }

      const parts = line.split('|').map((part) => part.trim())
      if (parts.length < 6) continue

      rows.push({
        file: parts[0],
        statements: parts[1],
        branches: parts[2],
        functions: parts[3],
        lines: parts[4],
        uncovered: parts[5] || '-',
      })
    }
  }

  const summary = {}
  const allFilesRow = rows.find((row) => row.file === 'All files')
  if (allFilesRow) {
    summary.statements = `${allFilesRow.statements}%`
    summary.branches = `${allFilesRow.branches}%`
    summary.functions = `${allFilesRow.functions}%`
    summary.lines = `${allFilesRow.lines}%`
  }

  if (Object.keys(summary).length === 0) {
    for (const metric of ['Statements', 'Branches', 'Functions', 'Lines']) {
      const summaryLine = lines.find((line) => {
        const cleaned = line.replace(/\x1b\[[0-9;]*m/g, '').trim()
        return cleaned.startsWith(metric)
      })
      if (summaryLine) {
        summary[metric.toLowerCase()] = summaryLine
          .replace(/\x1b\[[0-9;]*m/g, '')
          .trim()
      }
    }
  }

  return {
    rows,
    summary,
  }
}

const toRangeString = (numbers) => {
  if (!numbers.length) return '-'

  const sorted = [...new Set(numbers)].sort((a, b) => a - b)
  const ranges = []
  let start = sorted[0]
  let previous = sorted[0]

  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index]
    if (current === previous + 1) {
      previous = current
      continue
    }

    ranges.push(start === previous ? `${start}` : `${start}-${previous}`)
    start = current
    previous = current
  }

  ranges.push(start === previous ? `${start}` : `${start}-${previous}`)
  return ranges.join(',')
}

const parseLcovUncoveredMap = async () => {
  try {
    const content = await fs.readFile(coverageLcovPath, 'utf8')
    const records = content.split('end_of_record')
    const uncoveredByFile = new Map()

    for (const record of records) {
      const lines = record
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)

      const sfLine = lines.find((line) => line.startsWith('SF:'))
      if (!sfLine) continue

      const filePath = toPosixPath(path.relative(projectRoot, sfLine.slice(3)))
      const uncoveredLines = lines
        .filter((line) => line.startsWith('DA:'))
        .map((line) => line.slice(3).split(','))
        .filter((parts) => parts.length >= 2 && Number(parts[1]) === 0)
        .map((parts) => Number(parts[0]))
        .filter((value) => Number.isFinite(value))

      uncoveredByFile.set(filePath, toRangeString(uncoveredLines))
    }

    return uncoveredByFile
  } catch {
    return new Map()
  }
}

const resolveCoveragePath = (label, sourceEntries) => {
  const cleanLabel = (label || '').trim()
  if (!cleanLabel || cleanLabel === 'All files')
    return 'Cobertura global del proyecto'

  if (cleanLabel.startsWith('src')) {
    const direct = sourceEntries.find(
      (item) => item === cleanLabel || item.startsWith(`${cleanLabel}/`),
    )
    return direct || cleanLabel
  }

  if (!cleanLabel.includes('...')) {
    const exactSuffixMatches = sourceEntries.filter((item) =>
      item.endsWith(`/${cleanLabel}`),
    )
    if (exactSuffixMatches.length === 1) return exactSuffixMatches[0]
    if (exactSuffixMatches.length > 1) return exactSuffixMatches[0]
    return cleanLabel
  }

  const suffix = cleanLabel.replaceAll('...', '')
  const suffixMatches = sourceEntries.filter((item) => item.endsWith(suffix))
  if (suffixMatches.length === 1) return suffixMatches[0]
  if (suffixMatches.length > 1) return suffixMatches[0]

  return cleanLabel
}

const inferCoverageDisplayLabel = (label, resolvedPath) => {
  const cleanLabel = (label || '').trim()
  const cleanPath = (resolvedPath || '').trim()

  if (!cleanLabel) return '-'
  if (cleanLabel === 'All files') return 'All files'
  if (!cleanLabel.includes('...')) return cleanLabel
  if (!cleanPath || cleanPath === cleanLabel) return cleanLabel
  if (cleanPath === 'Cobertura global del proyecto') return 'All files'

  const normalizedPath = cleanPath.replaceAll('\\', '/')
  const pathParts = normalizedPath.split('/').filter(Boolean)
  const lastPart = pathParts[pathParts.length - 1] || normalizedPath

  if (lastPart.includes('.')) {
    return lastPart
  }

  return normalizedPath
}

const createCommandRecord = (id, label, command) => ({
  id,
  label,
  command,
  status: 'pending',
  summary: 'Pendiente',
  details: [],
  stdout: '',
  stderr: '',
  lastUpdatedAt: null,
})

const writeReport = async (report) => {
  const serialized = `window.__TEST_REPORT_DATA__ = ${JSON.stringify(report, null, 2)};\n`
  await fs.writeFile(outputPath, serialized, 'utf8')
}

const runCommand = (command, args) =>
  new Promise((resolve) => {
    const child = spawn([command, ...args].join(' '), {
      cwd: projectRoot,
      shell: true,
      windowsHide: true,
      env: process.env,
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('close', (code) => {
      resolve({
        code: code ?? 1,
        stdout,
        stderr,
      })
    })
  })

const createInitialReport = (tests) => ({
  generatedAt: formatTimestamp(),
  runState: 'running',
  summary: {
    total: tests.length,
    passed: 0,
    failed: 0,
    pending: tests.length,
    running: 0,
  },
  commands: [
    createCommandRecord(
      'typecheck',
      'npm run type:check',
      'npm run type:check',
    ),
    createCommandRecord('test-unit', 'npm run test:unit', 'npm run test:unit'),
    createCommandRecord(
      'test-integration',
      'npm run test:integration',
      'npm run test:integration',
    ),
    createCommandRecord(
      'coverage',
      'npm run test:coverage',
      'npm run test:coverage',
    ),
    createCommandRecord(
      'test-all',
      'Resumen visual de pipeline',
      'npm run type:check && npm run test:unit && npm run test:integration && npm run test:coverage',
    ),
  ],
  tests: tests.map((test, index) => ({
    id: `TC-${String(index + 1).padStart(3, '0')}`,
    file: test.relativePath,
    module: inferModule(test.relativePath),
    type: inferProjectType(test.relativePath),
    caseName: inferCaseName(test.relativePath),
    command: '',
    status: 'pending',
    summary: 'Pendiente de ejecucion',
    details: [],
    stdout: '',
    stderr: '',
    lastUpdatedAt: null,
  })),
  coverage: {
    rows: [],
    summary: {},
    glossary: COVERAGE_GLOSSARY,
  },
  highlights: [],
})

const refreshSummary = (report) => {
  const tests = report.tests
  const passed = tests.filter((test) => test.status === 'passed').length
  const failed = tests.filter((test) => test.status === 'failed').length
  const pending = tests.filter((test) => test.status === 'pending').length
  const running = tests.filter((test) => test.status === 'running').length

  report.summary = {
    total: tests.length,
    passed,
    failed,
    pending,
    running,
  }
}

const refreshHighlights = (report) => {
  const failingTests = report.tests.filter((test) => test.status === 'failed')
  const failingCommands = report.commands.filter(
    (command) => command.status === 'failed',
  )
  const passingTests = report.tests.filter((test) => test.status === 'passed')

  report.highlights = [
    {
      title: 'Estado general',
      tone:
        failingTests.length > 0 || failingCommands.length > 0 ? 'warn' : 'ok',
      body:
        failingTests.length > 0 || failingCommands.length > 0
          ? 'Existen fallos visibles en comandos o suites individuales.'
          : 'Sin fallos detectados en esta corrida.',
    },
    {
      title: 'Suites aprobadas',
      tone: passingTests.length > 0 ? 'ok' : 'warn',
      body: `${passingTests.length} de ${report.summary.total} suites individuales aprobadas.`,
    },
    {
      title: 'Nuevas pruebas',
      tone: 'info',
      body: 'El reporte detecta archivos *.test.ts del directorio tests. Si agregas nuevas suites, apareceran en la siguiente corrida.',
    },
  ]
}

const setSyntheticCommand = (report, commandId, payload) => {
  const command = report.commands.find((item) => item.id === commandId)
  if (!command) return

  Object.assign(command, payload)
  command.lastUpdatedAt = formatTimestamp()
}

const refreshAggregateCommands = (report) => {
  const unitTests = report.tests.filter((test) => test.type === 'unit')
  const integrationTests = report.tests.filter(
    (test) => test.type === 'integration',
  )
  const typecheckCommand = report.commands.find(
    (item) => item.id === 'typecheck',
  )
  const coverageCommand = report.commands.find((item) => item.id === 'coverage')

  const unitFailed = unitTests.filter((test) => test.status === 'failed')
  const integrationFailed = integrationTests.filter(
    (test) => test.status === 'failed',
  )
  const unitPending = unitTests.filter(
    (test) => test.status === 'pending' || test.status === 'running',
  )
  const integrationPending = integrationTests.filter(
    (test) => test.status === 'pending' || test.status === 'running',
  )

  setSyntheticCommand(report, 'test-unit', {
    label: 'Resumen visual de suites unitarias',
    status:
      unitPending.length > 0
        ? 'running'
        : unitFailed.length > 0
          ? 'failed'
          : 'passed',
    summary:
      unitPending.length > 0
        ? `Ejecutando ${unitTests.length} suites unitarias`
        : `${unitTests.length - unitFailed.length}/${unitTests.length} suites unitarias aprobadas`,
    details: [
      `${unitTests.length} suites unitarias detectadas`,
      `${unitTests.length - unitFailed.length} aprobadas`,
      `${unitFailed.length} fallidas`,
    ],
    stdout: unitTests
      .map(
        (test) =>
          `# ${test.file}\n${test.stdout || 'Sin stdout'}${test.stderr ? `\n\n[stderr]\n${test.stderr}` : ''}`,
      )
      .join('\n\n'),
    stderr: unitFailed
      .map((test) => `# ${test.file}\n${test.stderr || test.summary}`)
      .join('\n\n'),
  })

  setSyntheticCommand(report, 'test-integration', {
    label: 'Resumen visual de suites de integracion',
    status:
      integrationPending.length > 0
        ? 'running'
        : integrationFailed.length > 0
          ? 'failed'
          : 'passed',
    summary:
      integrationPending.length > 0
        ? `Ejecutando ${integrationTests.length} suites de integracion`
        : `${integrationTests.length - integrationFailed.length}/${integrationTests.length} suites de integracion aprobadas`,
    details: [
      `${integrationTests.length} suites de integracion detectadas`,
      `${integrationTests.length - integrationFailed.length} aprobadas`,
      `${integrationFailed.length} fallidas`,
    ],
    stdout: integrationTests
      .map(
        (test) =>
          `# ${test.file}\n${test.stdout || 'Sin stdout'}${test.stderr ? `\n\n[stderr]\n${test.stderr}` : ''}`,
      )
      .join('\n\n'),
    stderr: integrationFailed
      .map((test) => `# ${test.file}\n${test.stderr || test.summary}`)
      .join('\n\n'),
  })

  const unitCommand = report.commands.find((item) => item.id === 'test-unit')
  const integrationCommand = report.commands.find(
    (item) => item.id === 'test-integration',
  )
  const aggregateStatuses = [
    typecheckCommand?.status || 'pending',
    unitCommand?.status || 'pending',
    integrationCommand?.status || 'pending',
    coverageCommand?.status || 'pending',
  ]

  const hasRunning = aggregateStatuses.some(
    (status) => status === 'running' || status === 'pending',
  )
  const hasFailed = aggregateStatuses.some((status) => status === 'failed')

  setSyntheticCommand(report, 'test-all', {
    status: hasRunning ? 'running' : hasFailed ? 'failed' : 'passed',
    summary: hasRunning
      ? 'Pipeline global en ejecucion'
      : hasFailed
        ? 'Pipeline global con fallos visibles'
        : 'Pipeline global aprobada',
    details: [
      `type:check: ${typecheckCommand?.status || 'pending'}`,
      `test:unit: ${unitCommand?.status || 'pending'}`,
      `test:integration: ${integrationCommand?.status || 'pending'}`,
      `test:coverage: ${coverageCommand?.status || 'pending'}`,
    ],
    stdout: [
      '# npm run type:check',
      typecheckCommand?.stdout || 'Sin stdout',
      '',
      '# npm run test:unit',
      unitCommand?.stdout || 'Sin stdout',
      '',
      '# npm run test:integration',
      integrationCommand?.stdout || 'Sin stdout',
      '',
      '# npm run test:coverage',
      coverageCommand?.stdout || 'Sin stdout',
    ].join('\n'),
    stderr: [
      '# npm run type:check',
      typecheckCommand?.stderr || 'Sin stderr',
      '',
      '# npm run test:unit',
      unitCommand?.stderr || 'Sin stderr',
      '',
      '# npm run test:integration',
      integrationCommand?.stderr || 'Sin stderr',
      '',
      '# npm run test:coverage',
      coverageCommand?.stderr || 'Sin stderr',
    ].join('\n'),
  })
}

const updateCommandStatus = async (report, commandId, status, result) => {
  const command = report.commands.find((item) => item.id === commandId)
  if (!command) return

  const summary = extractSummary(result.stdout, result.stderr, status)

  command.status = status
  command.summary = summary.short
  command.details = summary.details
  command.stdout = normalizeOutput(result.stdout)
  command.stderr = normalizeOutput(result.stderr)
  command.lastUpdatedAt = formatTimestamp()
  if (commandId === 'coverage') {
    report.coverage = {
      ...parseCoverageData(result.stdout, result.stderr),
      glossary: report.coverage?.glossary || COVERAGE_GLOSSARY,
    }
  }
  report.generatedAt = formatTimestamp()
  refreshAggregateCommands(report)
  refreshHighlights(report)
  await writeReport(report)
}

const main = async () => {
  const allTests = await walk(testsRoot)
  const allSourceFiles = await walkSourceFiles(sourceRoot)
  const sourceFiles = allSourceFiles
    .map((fullPath) => toPosixPath(path.relative(projectRoot, fullPath)))
    .sort((a, b) => a.localeCompare(b))
  const sourceDirectories = Array.from(
    new Set(
      sourceFiles
        .map((filePath) => filePath.split('/').slice(0, -1).join('/'))
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b))
  const sourceEntries = [...sourceDirectories, ...sourceFiles]
  const tests = allTests
    .map((fullPath) => ({
      fullPath,
      relativePath: toPosixPath(path.relative(projectRoot, fullPath)),
    }))
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath))

  const report = createInitialReport(tests)
  refreshAggregateCommands(report)
  await writeReport(report)

  const [typecheckCommand, typecheckArgs] = TYPECHECK_COMMAND
  await updateCommandStatus(report, 'typecheck', 'running', {
    stdout: 'Ejecutando typecheck...',
    stderr: '',
  })
  const typecheckResult = await runCommand(typecheckCommand, typecheckArgs)
  await updateCommandStatus(
    report,
    'typecheck',
    badgeStatusByExitCode(typecheckResult.code),
    typecheckResult,
  )

  for (const test of report.tests) {
    test.status = 'running'
    test.summary = 'Ejecutando suite...'
    test.details = []
    test.lastUpdatedAt = formatTimestamp()
    report.generatedAt = formatTimestamp()
    refreshSummary(report)
    refreshAggregateCommands(report)
    refreshHighlights(report)
    await writeReport(report)

    const vitestArgs = ['vitest', 'run', test.file, '--project', test.type]
    test.command = `npx vitest run ${test.file} --project ${test.type}`
    const result = await runCommand('npx.cmd', vitestArgs)
    const summary = extractSummary(
      result.stdout,
      result.stderr,
      badgeStatusByExitCode(result.code),
    )

    test.status = badgeStatusByExitCode(result.code)
    test.summary = summary.short
    test.details = summary.details
    test.stdout = normalizeOutput(result.stdout)
    test.stderr = normalizeOutput(result.stderr)
    test.lastUpdatedAt = formatTimestamp()
    report.generatedAt = formatTimestamp()
    refreshSummary(report)
    refreshAggregateCommands(report)
    refreshHighlights(report)
    await writeReport(report)
  }

  const [coverageCommand, coverageArgs] = COVERAGE_COMMAND
  await updateCommandStatus(report, 'coverage', 'running', {
    stdout: 'Ejecutando coverage...',
    stderr: '',
  })
  const coverageResult = await runCommand(coverageCommand, coverageArgs)
  await updateCommandStatus(
    report,
    'coverage',
    badgeStatusByExitCode(coverageResult.code),
    coverageResult,
  )
  const lcovUncoveredMap = await parseLcovUncoveredMap()
  report.coverage.rows = report.coverage.rows.map((row) => ({
    ...row,
    resolvedPath: resolveCoveragePath(row.file, sourceEntries),
    displayLabel: inferCoverageDisplayLabel(
      row.file,
      resolveCoveragePath(row.file, sourceEntries),
    ),
    uncovered: (() => {
      const resolvedPath = resolveCoveragePath(row.file, sourceEntries)
      return lcovUncoveredMap.get(resolvedPath) || row.uncovered
    })(),
  }))

  report.runState = 'completed'
  report.generatedAt = formatTimestamp()
  refreshSummary(report)
  refreshAggregateCommands(report)
  refreshHighlights(report)
  await writeReport(report)
}

main().catch(async (error) => {
  const fallbackReport = {
    generatedAt: formatTimestamp(),
    runState: 'error',
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      pending: 0,
      running: 0,
    },
    commands: [],
    tests: [],
    highlights: [
      {
        title: 'Error al generar reporte',
        tone: 'warn',
        body: escapeHtml(
          error instanceof Error ? error.message : String(error),
        ),
      },
    ],
  }

  await writeReport(fallbackReport)
  process.exitCode = 1
})
