import type { TestReportData } from '../types'

interface CoverageTabProps {
  data: TestReportData
}

export function CoverageTab({ data }: CoverageTabProps) {
  const rows = data.coverage?.rows || []
  const glossary = data.coverage?.glossary || {}
  const summary = data.coverage?.summary || {}

  return (
    <section className="tab-panel">
      <section className="one-col">
        <article className="card section">
          <h2>Tabla de Coverage</h2>
          <p className="lead">Apartado dedicado al reporte de cobertura extraido desde la salida real de <code className="mono">npm run test:coverage</code>.</p>

          <div className="coverage-summary-grid">
            {Object.entries(glossary).map(([key, value]) => (
              <div key={key} className="callout">
                <strong>{key}</strong>
                <div>{value}</div>
              </div>
            ))}
          </div>

          <div className="coverage-summary-grid">
            {Object.entries(summary).map(([key, value]) => (
              <div key={key} className="callout">
                <strong>{key}</strong>
                <div className="summary-main">{value}</div>
              </div>
            ))}
          </div>

          {rows.length > 0 ? (
            <div className="coverage-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Archivo</th>
                    <th>% Stmts</th>
                    <th>% Branch</th>
                    <th>% Funcs</th>
                    <th>% Lines</th>
                    <th>Uncovered</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={index}>
                      <td data-label="Archivo">
                        <div>{row.displayLabel || row.file}</div>
                        <div className="summary-meta">{row.resolvedPath || row.file}</div>
                      </td>
                      <td data-label="% Stmts">{row.statements}</td>
                      <td data-label="% Branch">{row.branches}</td>
                      <td data-label="% Funcs">{row.functions}</td>
                      <td data-label="% Lines">{row.lines}</td>
                      <td data-label="Uncovered">{row.uncovered}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">Aun no hay datos de coverage para mostrar.</div>
          )}
        </article>
      </section>
    </section>
  )
}
