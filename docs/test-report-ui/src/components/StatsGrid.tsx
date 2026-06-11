import type { TestSummary } from '../types'

interface StatsGridProps {
  summary: TestSummary
}

export function StatsGrid({ summary }: StatsGridProps) {
  const stats = [
    {
      label: 'Suites detectadas',
      value: summary.total,
      note: 'Archivos *.test.ts encontrados en tests/',
    },
    {
      label: 'Aprobadas',
      value: summary.passed,
      note: 'Suites con salida exitosa',
    },
    {
      label: 'Fallidas',
      value: summary.failed,
      note: 'Suites o comandos con error',
    },
    {
      label: 'Pendientes',
      value: summary.pending,
      note: 'Aun no ejecutadas en esta corrida',
    },
    {
      label: 'En ejecucion',
      value: summary.running,
      note: 'Se actualizan mientras corre script',
    },
  ]

  return (
    <section className="grid stats">
      {stats.map((stat) => (
        <article key={stat.label} className="card stat">
          <div className="stat-label">{stat.label}</div>
          <div className="stat-value">{stat.value}</div>
          <div className="stat-note">{stat.note}</div>
        </article>
      ))}
    </section>
  )
}
