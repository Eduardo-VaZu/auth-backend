export function ConclusionsTab() {
  return (
    <section className="tab-panel">
      <section className="one-col">
        <article className="card section">
          <h2>Conclusiones</h2>
          <p className="lead">Hallazgos finales y recomendaciones técnicas del proceso de testing.</p>

          <div className="stack">
            <div className="callout">
              <strong>Cobertura de Pruebas</strong>
              <p>El proyecto cuenta con <strong>20 suites de pruebas</strong> distribuidas en 5 módulos principales (health, identity, access, credentials, admin/audit). Las pruebas unitarias cubren la lógica de negocio crítica, mientras que las pruebas de integración validan flujos HTTP completos.</p>
              <p style={{ marginTop: 12 }}>El coverage actual se encuentra <strong>por debajo del threshold configurado</strong> (45% para statements/lines, 40% para branches/functions). Esto indica que hay código productivo significativo sin cobertura de pruebas.</p>
            </div>

            <div className="callout">
              <strong>Calidad de Implementación</strong>
              <p>Las pruebas existentes demuestran buenas prácticas: uso de mocks para aislamiento, testcontainers para integración real, y validación de casos edge. Sin embargo, la cobertura insuficiente sugiere áreas de riesgo no validadas.</p>
            </div>

            <div className="callout">
              <strong>Defectos Identificados</strong>
              <ul style={{ margin: '8px 0 0', paddingLeft: 20, color: 'var(--muted)' }}>
                <li>Cobertura por debajo de thresholds configurados</li>
                <li>Pruebas de integración dependientes de Docker (PostgreSQL + Redis)</li>
                <li>Módulos con 0% coverage (ej: domain entities de access)</li>
              </ul>
            </div>

            <div className="callout">
              <strong>Recomendaciones Técnicas</strong>
              <ol style={{ margin: '8px 0 0', paddingLeft: 20, color: 'var(--muted)', lineHeight: 1.8 }}>
                <li><strong>Aumentar coverage de domain entities:</strong> Agregar tests unitarios para entidades de dominio (User, RefreshToken, UserSession) que actualmente tienen 0% coverage.</li>
                <li><strong>Reducir dependencia de Docker local:</strong> Usar testcontainers de forma más eficiente o mockear servicios externos para pruebas de integración más rápidas.</li>
                <li><strong>Revisar thresholds de coverage:</strong> Considerar si los thresholds actuales (45%/40%) son realistas o deben ajustarse según la madurez del proyecto.</li>
                <li><strong>Agregar pruebas de edge cases:</strong> Validar escenarios de error, concurrencia y límites en use cases críticos (login, refresh token, cambio de password).</li>
                <li><strong>Automatizar ejecución en CI:</strong> Asegurar que todas las pruebas se ejecuten en cada PR para detectar regresiones tempranas.</li>
              </ol>
            </div>

            <div className="callout">
              <strong>Próximos Pasos</strong>
              <ul style={{ margin: '8px 0 0', paddingLeft: 20, color: 'var(--muted)' }}>
                <li>Priorizar tests en módulos con menor coverage</li>
                <li>Implementar pruebas de performance para endpoints críticos</li>
                <li>Evaluar migración a ESM completo para mejorar tree-shaking</li>
                <li>Considerar herramientas de mutation testing para validar calidad de tests</li>
              </ul>
            </div>
          </div>
        </article>
      </section>
    </section>
  )
}
