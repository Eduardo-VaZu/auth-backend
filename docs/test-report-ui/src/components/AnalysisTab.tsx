import type { TestReportData } from '../types'

interface AnalysisTabProps {
  data: TestReportData
}

export function AnalysisTab({ data }: AnalysisTabProps) {
  const total = data.summary.total || 0
  const passed = data.summary.passed || 0
  const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0'

  const coverageRow = data.coverage?.rows?.find((row) => row.file === 'All files')
  const parseMetric = (value: string | undefined) => {
    const numeric = Number.parseFloat(String(value ?? '0').replace(',', '.'))
    return Number.isFinite(numeric) ? numeric : 0
  }

  const thresholds = { statements: 45, branches: 40, functions: 40, lines: 45 }
  const coverageMetrics = [
    { name: 'Statements', value: parseMetric(coverageRow?.statements), threshold: thresholds.statements },
    { name: 'Branches', value: parseMetric(coverageRow?.branches), threshold: thresholds.branches },
    { name: 'Functions', value: parseMetric(coverageRow?.functions), threshold: thresholds.functions },
    { name: 'Lines', value: parseMetric(coverageRow?.lines), threshold: thresholds.lines },
  ]

  const failedTests = data.tests.filter((test) => test.status === 'failed')

  const lowCoverageRows = data.coverage?.rows
    ?.filter((row) => row.file !== 'All files')
    .map((row) => ({
      ...row,
      avgCoverage: (parseMetric(row.statements) + parseMetric(row.lines)) / 2,
    }))
    .filter((row) => row.avgCoverage < 20)
    .sort((a, b) => a.avgCoverage - b.avgCoverage)
    .slice(0, 5) || []

  const recommendations = []
  if (Number.parseFloat(passRate) < 100) {
    recommendations.push(`Aumentar tasa de aprobación al 100% (actual: ${passRate}%)`)
  }
  if (coverageRow && parseMetric(coverageRow.statements) < thresholds.statements) {
    recommendations.push(`Incrementar coverage de statements al ${thresholds.statements}% (actual: ${coverageRow.statements}%)`)
  }
  if (coverageRow && parseMetric(coverageRow.branches) < thresholds.branches) {
    recommendations.push(`Mejorar coverage de branches al ${thresholds.branches}% (actual: ${coverageRow.branches}%)`)
  }
  if (failedTests.length > 0) {
    recommendations.push(`Investigar y corregir ${failedTests.length} suite(s) fallida(s)`)
  }
  if (lowCoverageRows.length > 0) {
    recommendations.push(`Priorizar tests en ${lowCoverageRows.length} archivo(s) con coverage < 20%`)
  }
  if (recommendations.length === 0) {
    recommendations.push('Todos los thresholds cumplidos. Considerar aumentar thresholds para mejorar calidad.')
  }

  return (
    <section className="tab-panel">
      <section className="one-col">
        <article className="card section">
          <h2>Análisis de Resultados</h2>
          <p className="lead">Evaluación crítica de la calidad de pruebas, coverage y hallazgos automáticos.</p>

          <div className="stack">
            <div className="callout">
              <strong>Tasa de Aprobación</strong>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent)' }}>{passRate}%</div>
              <div style={{ marginTop: 4, color: 'var(--muted)' }}>{passed} de {total} suites aprobadas</div>
            </div>

            <div className="callout">
              <strong>Cobertura vs Thresholds</strong>
              {coverageMetrics.map((metric) => (
                <div key={metric.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span>{metric.name}:</span>
                  <span style={{ color: metric.value >= metric.threshold ? 'var(--ok)' : 'var(--bad)', fontWeight: 600 }}>
                    {metric.value >= metric.threshold ? '✓' : '✗'} {metric.value}% / {metric.threshold}%
                  </span>
                </div>
              ))}
            </div>

            <div className="callout">
              <strong>Suites Fallidas</strong>
              {failedTests.length === 0 ? (
                <div style={{ color: 'var(--ok)' }}>No hay suites fallidas</div>
              ) : (
                failedTests.map((test) => (
                  <div key={test.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                    <div style={{ fontWeight: 600 }}>{test.caseName}</div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>{test.file}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--bad)', marginTop: 4 }}>{test.summary}</div>
                  </div>
                ))
              )}
            </div>

            <div className="callout">
              <strong>Módulos con Menor Coverage</strong>
              {lowCoverageRows.length === 0 ? (
                <div style={{ color: 'var(--ok)' }}>No hay módulos con coverage crítico</div>
              ) : (
                lowCoverageRows.map((row, idx) => (
                  <div key={idx} style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                    <div style={{ fontWeight: 600 }}>{row.displayLabel || row.file}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--bad)' }}>
                      Statements: {row.statements}% | Lines: {row.lines}%
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="callout">
              <strong>Recomendaciones Automáticas</strong>
              <ul style={{ margin: '8px 0 0', paddingLeft: 20, color: 'var(--muted)' }}>
                {recommendations.map((rec, idx) => (
                  <li key={idx} style={{ marginBottom: 6 }}>{rec}</li>
                ))}
              </ul>
            </div>
          </div>
        </article>
      </section>
    </section>
  )
}
