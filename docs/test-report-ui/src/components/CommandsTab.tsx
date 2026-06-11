import type { TestReportData } from '../types'

interface CommandsTabProps {
  data: TestReportData
}

export function CommandsTab({ data }: CommandsTabProps) {
  const statusClass = (status: string) => `badge status-${status || 'pending'}`
  const statusLabel = (status: string) => {
    const labels: Record<string, string> = {
      passed: 'Aprobado',
      failed: 'Fallido',
      pending: 'Pendiente',
      running: 'Ejecutando',
    }
    return labels[status] || status
  }

  const formatDate = (value: string) => {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString('es-PE')
  }

  return (
    <section className="tab-panel">
      <section className="one-col">
        <article className="card section">
          <h2>Comandos Globales</h2>
          <p className="lead">Bloque separado para revisar pipeline, salida completa y estados agregados.</p>
          <div className="commands-grid">
            {data.commands.length > 0 ? (
              data.commands.map((command) => (
                <div key={command.id} className="callout">
                  <strong className="mono">{command.label}</strong>
                  <div style={{ marginTop: 8 }}>
                    <span className={statusClass(command.status)}>{statusLabel(command.status)}</span>
                  </div>
                  <div style={{ marginTop: 10 }} className="summary-main">{command.summary}</div>
                  {command.details.length > 0 && (
                    <ul className="details">
                      {command.details.map((detail, idx) => (
                        <li key={idx}>{detail}</li>
                      ))}
                    </ul>
                  )}
                  <div className="summary-meta">Actualizado: {formatDate(command.lastUpdatedAt)}</div>
                </div>
              ))
            ) : (
              <div className="empty">Sin comandos registrados aun.</div>
            )}
          </div>
        </article>
      </section>
    </section>
  )
}
