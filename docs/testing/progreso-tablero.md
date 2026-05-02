# Tablero De Progreso De Pruebas

Usar este archivo para seguimiento diario.
Estados permitidos: `Pendiente | En curso | Hecho`.

## Estado General

| Integrante | Modulo            | Tipo        | Suite/Archivo                            | Estado    | Evidencia | Fecha | PR  |
| ---------- | ----------------- | ----------- | ---------------------------------------- | --------- | --------- | ----- | --- |
| 1          | identity          | Unit        | RegisterUseCase.test.ts                  | Pendiente | -         | -     | -   |
| 1          | identity          | Integration | RegisterFlow.test.ts                     | Pendiente | -         | -     | -   |
| 2          | access            | Unit        | LoginUseCase.test.ts                     | Pendiente | -         | -     | -   |
| 2          | access            | Integration | LoginFlow.test.ts                        | Pendiente | -         | -     | -   |
| 3          | access            | Unit        | SessionUseCases.test.ts                  | Pendiente | -         | -     | -   |
| 3          | access            | Integration | SessionLifecycle.test.ts                 | Pendiente | -         | -     | -   |
| 4          | credentials       | Unit        | CredentialsUseCases.test.ts              | Pendiente | -         | -     | -   |
| 4          | credentials       | Integration | CredentialsFlow.test.ts                  | Pendiente | -         | -     | -   |
| 5          | admin/audit/infra | Unit        | AdminUseCases.test.ts                    | Pendiente | -         | -     | -   |
| 5          | admin/audit/infra | Integration | AdminFlow/AuditFlow/CleanupDataLifecycle | Pendiente | -         | -     | -   |
| 5          | ci                | CI          | node.js.yml + scripts ci                 | Pendiente | -         | -     | -   |

## Definition Of Done (DoD)

- Unit:
  - Casos positivos, negativos y borde cubiertos.
  - Sin DB/Redis reales (mocks/fakes).
- Integration:
  - Flujo HTTP completo.
  - Aislamiento y limpieza de datos.
- CI:
  - `type:check`, `lint`, `test:unit:ci`, `test:integration:ci`, `build` en verde.
- Evidencia:
  - Comando ejecutado + salida resumida + fecha.
