import { useState } from 'react'
import type { TestReportData } from '../types'

interface SuitesTabProps {
  data: TestReportData
}

export function SuitesTab({ data }: SuitesTabProps) {
  const [filter, setFilter] = useState<string>('all')

  const filteredTests = data.tests.filter((test) => {
    if (filter === 'all') return true
    return test.status === filter
  })

  const statusClass = (status: string) => `badge status-${status || 'pending'}`
  const statusLabel = (status: string) => {
    const labels: Record<string, string> = {
      passed: 'Aprobada',
      failed: 'Fallida',
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
          <div className="toolbar">
            <div>
              <h2>Suites Detectadas</h2>
              <small>
                Vista dinamica por archivo de prueba, con columnas separadas
                para lectura mas clara.
              </small>
            </div>
            <div className="filters">
              {['all', 'passed', 'failed', 'running', 'pending'].map((f) => (
                <button
                  key={f}
                  className={`filter-chip ${filter === f ? 'active' : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f === 'all'
                    ? 'Todas'
                    : f === 'passed'
                      ? 'Aprobadas'
                      : f === 'failed'
                        ? 'Fallidas'
                        : f === 'running'
                          ? 'En ejecucion'
                          : 'Pendientes'}
                </button>
              ))}
            </div>
          </div>

          {filteredTests.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Modulo</th>
                  <th>Tipo</th>
                  <th>Suite</th>
                  <th>Resultado</th>
                  <th>Detalles y ejecucion</th>
                  <th>Actualizado</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filteredTests.map((test) => (
                  <tr key={test.id}>
                    <td data-label="ID">{test.id}</td>
                    <td data-label="Modulo">{test.module}</td>
                    <td data-label="Tipo">{test.type}</td>
                    <td data-label="Suite">
                      <strong>{test.caseName}</strong>
                      <div className="file">{test.file}</div>
                    </td>
                    <td data-label="Resultado">
                      <div className="summary-main">{test.summary}</div>
                    </td>
                    <td data-label="Detalles y ejecucion">
                      <div className="summary-meta">
                        {test.type === 'integration'
                          ? 'Suite de integracion HTTP o de flujo'
                          : 'Suite unitaria o de logica aislada'}
                      </div>
                      {test.details.length > 0 && (
                        <ul className="details">
                          {test.details.map((detail, idx) => (
                            <li key={idx}>{detail}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td data-label="Actualizado">
                      {formatDate(test.lastUpdatedAt)}
                    </td>
                    <td data-label="Estado">
                      <span className={statusClass(test.status)}>
                        {statusLabel(test.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">
              No hay suites para mostrar con el filtro actual.
            </div>
          )}
        </article>
      </section>
    </section>
  )
}
