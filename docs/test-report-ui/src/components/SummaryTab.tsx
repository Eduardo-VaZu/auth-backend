import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
} from 'chart.js'
import { Doughnut, Bar } from 'react-chartjs-2'
import type { TestReportData } from '../types'
import type { Theme } from '../hooks/useTheme'
import { ProgressBar } from './ProgressBar'

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
)

interface SummaryTabProps {
  data: TestReportData
  theme: Theme
}

export function SummaryTab({ data, theme }: SummaryTabProps) {
  const inkColor = theme === 'dark' ? '#e5e7eb' : '#1f2937'
  const mutedColor = theme === 'dark' ? '#9ca3af' : '#6b7280'
  const gridColor =
    theme === 'dark' ? 'rgba(45, 49, 72, 0.9)' : 'rgba(229, 220, 207, 0.9)'

  const suiteData = {
    labels: ['Aprobadas', 'Fallidas', 'Pendientes', 'En ejecucion'],
    datasets: [
      {
        data: [
          data.summary.passed || 0,
          data.summary.failed || 0,
          data.summary.pending || 0,
          data.summary.running || 0,
        ],
        backgroundColor: ['#0f766e', '#b91c1c', '#d97706', '#2563eb'],
        borderColor: '#fffdf8',
        borderWidth: 3,
        hoverOffset: 8,
      },
    ],
  }

  const coverageRow = data.coverage?.rows?.find(
    (row) => row.file === 'All files',
  )
  const parseMetric = (value: string | undefined) => {
    const numeric = Number.parseFloat(String(value ?? '0').replace(',', '.'))
    return Number.isFinite(numeric) ? numeric : 0
  }

  const coverageData = {
    labels: ['Statements', 'Branches', 'Functions', 'Lines'],
    datasets: [
      {
        label: 'Cobertura %',
        data: [
          parseMetric(coverageRow?.statements),
          parseMetric(coverageRow?.branches),
          parseMetric(coverageRow?.functions),
          parseMetric(coverageRow?.lines),
        ],
        backgroundColor: ['#0f766e', '#0ea5e9', '#f59e0b', '#7c3aed'],
        borderRadius: 12,
        maxBarThickness: 52,
      },
    ],
  }

  const passRate =
    data.summary.total > 0
      ? (data.summary.passed / data.summary.total) * 100
      : 0

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
  }

  const doughnutOptions = {
    ...chartOptions,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          usePointStyle: true,
          padding: 18,
          color: inkColor,
        },
      },
    },
  }

  const barOptions = {
    ...chartOptions,
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        ticks: {
          callback: (value: number | string) => `${value}%`,
          color: mutedColor,
        },
        grid: {
          color: gridColor,
        },
      },
      x: {
        ticks: {
          color: inkColor,
        },
        grid: {
          display: false,
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
    },
  }

  return (
    <section className="tab-panel active">
      <section className="two-col">
        <article className="card section">
          <h2>Estado General</h2>
          <p className="lead">
            Resumen rapido de la corrida actual y del tablero dinamico.
          </p>
          <div className="stack">
            <div className="callout">
              <strong>Estado de ejecucion</strong>
              <div>
                {data.runState === 'completed' ? 'Completada' : data.runState}
              </div>
            </div>
            <div className="callout">
              <strong>Ultima actualizacion</strong>
              <div>{new Date(data.generatedAt).toLocaleString('es-PE')}</div>
            </div>
            <div className="callout">
              <strong>Suites detectadas</strong>
              <div>{data.summary.total} suites</div>
            </div>
          </div>
        </article>

        <article className="card section">
          <h2>Tasa de Aprobacion</h2>
          <p className="lead">
            Porcentaje de suites aprobadas sobre el total detectado.
          </p>
          <ProgressBar
            value={data.summary.passed}
            maxValue={data.summary.total}
            label="Tests Aprobados"
            color="#0f766e"
          />
          <div className="stack" style={{ marginTop: '16px' }}>
            <div className="callout">
              <strong>
                {data.summary.passed} / {data.summary.total}
              </strong>
              <div>{passRate.toFixed(1)}% de aprobacion</div>
            </div>
          </div>
        </article>
      </section>

      <section className="two-col" style={{ marginTop: '24px' }}>
        <article className="card section">
          <h2>Cobertura de Codigo</h2>
          <p className="lead">Porcentaje de cobertura global por metrica.</p>
          <ProgressBar
            value={parseMetric(coverageRow?.statements)}
            label="Statements"
            color="#0f766e"
          />
          <ProgressBar
            value={parseMetric(coverageRow?.branches)}
            label="Branches"
            color="#0ea5e9"
          />
          <ProgressBar
            value={parseMetric(coverageRow?.functions)}
            label="Functions"
            color="#f59e0b"
          />
          <ProgressBar
            value={parseMetric(coverageRow?.lines)}
            label="Lines"
            color="#7c3aed"
          />
        </article>

        <article className="card section">
          <h2>Uso</h2>
          <div className="stack">
            <div className="callout">
              <strong>1. Ejecutar corrida dinamica</strong>
              <span className="mono">npm run test:report:dynamic</span>
            </div>
            <div className="callout">
              <strong>2. Dejar este HTML abierto</strong>
              La pagina recarga datos cada 3 segundos.
            </div>
            <div className="callout">
              <strong>3. Agregar nuevas suites</strong>
              Cualquier archivo nuevo{' '}
              <span className="mono">tests/**/*.test.ts</span> aparecera
              automaticamente en la siguiente corrida.
            </div>
          </div>
        </article>
      </section>

      <section className="chart-grid">
        <article className="card chart-panel">
          <h3>Estado de Suites</h3>
          <p>
            Distribucion visual de suites aprobadas, fallidas, pendientes y en
            ejecucion.
          </p>
          <div className="chart-canvas-wrap">
            <Doughnut data={suiteData} options={doughnutOptions} />
          </div>
        </article>

        <article className="card chart-panel">
          <h3>Cobertura Global</h3>
          <p>
            Comparacion de cobertura total para statements, branches, functions
            y lines.
          </p>
          <div className="chart-canvas-wrap">
            <Bar data={coverageData} options={barOptions} />
          </div>
        </article>
      </section>
    </section>
  )
}
