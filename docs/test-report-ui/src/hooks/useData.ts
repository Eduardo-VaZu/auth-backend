import { useState, useEffect, useCallback } from 'react'
import type { TestReportData } from '../types'

const DATA_FILE = './data.js'

declare global {
  interface Window {
    __TEST_REPORT_DATA__?: TestReportData
  }
}

const defaultData: TestReportData = {
  generatedAt: '',
  runState: 'idle',
  summary: { total: 0, passed: 0, failed: 0, pending: 0, running: 0 },
  commands: [],
  tests: [],
  coverage: {
    rows: [],
    summary: {},
    glossary: {
      statements: 'Porcentaje de instrucciones del codigo ejecutadas por las pruebas.',
      branches: 'Porcentaje de caminos condicionales cubiertos, por ejemplo if/else o ternarios.',
      functions: 'Porcentaje de funciones o metodos ejecutados al menos una vez.',
      lines: 'Porcentaje de lineas ejecutadas durante la corrida.',
      uncovered: 'Lineas o rangos que no fueron cubiertos por las pruebas segun el reporte.',
    },
  },
  highlights: [],
}

export function useData() {
  const [data, setData] = useState<TestReportData>(() => {
    return window.__TEST_REPORT_DATA__ || defaultData
  })

  const loadData = useCallback(() => {
    const script = document.createElement('script')
    script.src = `${DATA_FILE}?t=${Date.now()}`
    script.onload = () => {
      setData(window.__TEST_REPORT_DATA__ || defaultData)
      script.remove()
    }
    script.onerror = () => {
      script.remove()
    }
    document.body.appendChild(script)
  }, [])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 3000)
    return () => clearInterval(interval)
  }, [loadData])

  return { data, reloadData: loadData }
}
