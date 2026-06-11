import type { TestReportData } from '../types'

interface FindingsTabProps {
  data: TestReportData
}

export function FindingsTab({ data }: FindingsTabProps) {
  const toneClass = (tone: string) => {
    if (tone === 'ok') return 'badge ok'
    if (tone === 'warn') return 'badge bad'
    return 'badge info'
  }

  return (
    <section className="tab-panel">
      <section className="two-col">
        <article className="card section">
          <h2>Hallazgos Activos</h2>
          <div className="stack">
            {data.highlights.length > 0 ? (
              data.highlights.map((item, idx) => (
                <div key={idx} className="callout">
                  <strong>{item.title}</strong>
                  <div>
                    <span className={toneClass(item.tone)}>{item.tone}</span>
                  </div>
                  <div style={{ marginTop: 8 }}>{item.body}</div>
                </div>
              ))
            ) : (
              <div className="empty">Sin hallazgos registrados.</div>
            )}
          </div>
        </article>

        <article className="card section">
          <h2>Contexto</h2>
          <div className="stack">
            <div className="callout">
              <strong>Proposito</strong>
              Tablero dinamico para visualizar suites, comandos, coverage y
              errores de forma separada.
            </div>
            <div className="callout">
              <strong>Fuente de datos</strong>
              <span className="mono">docs/test-report/data.js</span>
            </div>
            <div className="callout">
              <strong>Actualizacion</strong>
              Recarga automatica cada 3 segundos.
            </div>
          </div>
        </article>
      </section>
    </section>
  )
}
