import { promises as fs } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const projectRoot = process.cwd()
const outputPath = path.join(
  projectRoot,
  'docs',
  'test-report-ui',
  'public',
  'data.js',
)

const emptyReport = {
  generatedAt: new Date().toISOString(),
  runState: 'idle',
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    pending: 0,
    running: 0,
  },
  commands: [],
  tests: [],
  coverage: {
    rows: [],
    summary: {},
    glossary: {
      statements:
        'Porcentaje de instrucciones del codigo ejecutadas por las pruebas.',
      branches:
        'Porcentaje de caminos condicionales cubiertos, por ejemplo if/else o ternarios.',
      functions:
        'Porcentaje de funciones o metodos ejecutados al menos una vez.',
      lines: 'Porcentaje de lineas ejecutadas durante la corrida.',
      uncovered:
        'Lineas o rangos que no fueron cubiertos por las pruebas segun el reporte.',
    },
  },
  highlights: [
    {
      title: 'Tablero limpio',
      tone: 'info',
      body: 'No hay resultados cargados. Ejecuta npm run test:report:dynamic para generar una nueva corrida.',
    },
  ],
}

const serialized = `window.__TEST_REPORT_DATA__ = ${JSON.stringify(emptyReport, null, 2)};\n`

await fs.writeFile(outputPath, serialized, 'utf8')
