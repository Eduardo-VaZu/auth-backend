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
}

export function SummaryTab({ data }: SummaryTabProps) {
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
          color: '#1f2937',
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
          color: '#6b7280',
        },
        grid: {
          color: 'rgba(229, 220, 207, 0.9)',
        },
      },
      x: {
        ticks: {
          color: '#1f2937',
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
