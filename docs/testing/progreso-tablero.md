# Tablero De Progreso De Pruebas

Usar este archivo para seguimiento diario.
Estados permitidos: `Pendiente | En curso | Hecho`.

## Estado General

| Integrante | Modulo            | Tipo        | Suite/Archivo                | Estado | Evidencia                                   | Fecha      | PR  |
| ---------- | ----------------- | ----------- | ---------------------------- | ------ | ------------------------------------------- | ---------- | --- |
| 1          | health            | Unit        | HealthController.test.ts     | Hecho  | `vitest run` (4 unit tests, 9ms)            | 2026-06-11 | -   |
| 1          | identity          | Unit        | IdentityDomain.test.ts       | Hecho  | `vitest run` (10 unit tests, 22ms)          | 2026-06-11 | -   |
| 1          | identity          | Unit        | RegisterUseCase.test.ts      | Hecho  | `vitest run` (2 unit tests, 579ms)          | 2026-06-11 | -   |
| 1          | identity          | Integration | RegisterFlow.test.ts         | Hecho  | `vitest run` (7 integration tests, 180ms)   | 2026-06-11 | -   |
| 2          | access            | Unit        | LoginUseCase.test.ts         | Hecho  | `vitest run` (7 unit tests, 409ms)          | 2026-06-11 | -   |
| 2          | access            | Unit        | LogoutUseCase.test.ts        | Hecho  | `vitest run` (1 unit test, 8ms)             | 2026-06-11 | -   |
| 2          | access            | Unit        | RefreshTokenUseCase.test.ts  | Hecho  | `vitest run` (5 unit tests, 283ms)          | 2026-06-11 | -   |
| 2          | access            | Unit        | Duration.test.ts             | Hecho  | `vitest run` (2 unit tests, 6ms)            | 2026-06-11 | -   |
| 2          | access            | Unit        | TokenService.test.ts         | Hecho  | `vitest run` (4 unit tests, 12ms)           | 2026-06-11 | -   |
| 2          | access            | Integration | PublicAuthRoutes.test.ts     | Hecho  | `vitest run` (2 integration tests, 69ms)    | 2026-06-11 | -   |
| 2          | access            | Integration | LoginFlow.test.ts            | Hecho  | `vitest run` (5 integration tests, 8194ms)  | 2026-06-11 | -   |
| 3          | access            | Unit        | AccessDomain.test.ts         | Hecho  | `vitest run` (9 unit tests, 6ms)            | 2026-06-11 | -   |
| 3          | access            | Unit        | SessionUseCases.test.ts      | Hecho  | `vitest run` (7 unit tests, 14ms)           | 2026-06-11 | -   |
| 3          | access            | Unit        | SessionRepositories.test.ts  | Hecho  | `vitest run` (10 unit tests, 12ms)          | 2026-06-11 | -   |
| 3          | access            | Integration | SessionLifecycle.test.ts     | Hecho  | `vitest run` (6 integration tests, 57ms)    | 2026-06-11 | -   |
| 4          | credentials       | Unit        | CredentialsDomain.test.ts    | Hecho  | `vitest run` (4 unit tests, 9ms)            | 2026-06-11 | -   |
| 4          | credentials       | Unit        | ParseOneTimeToken.test.ts    | Hecho  | `vitest run` (6 unit tests, 6ms)            | 2026-06-11 | -   |
| 4          | credentials       | Unit        | CredentialsUseCases.test.ts  | Hecho  | `vitest run` (14 unit tests, 17ms)          | 2026-06-11 | -   |
| 4          | credentials       | Unit        | AuthEmailService.test.ts     | Hecho  | `vitest run` (4 unit tests, 14ms)           | 2026-06-11 | -   |
| 4          | credentials       | Integration | CredentialsFlow.test.ts      | Hecho  | `vitest run` (8 integration tests, 64ms)    | 2026-06-11 | -   |
| 5          | admin/audit/infra | Unit        | AdminUseCases.test.ts        | Hecho  | `vitest run` (18 unit tests, 31ms)          | 2026-06-11 | -   |
| 5          | audit             | Unit        | ListAuditLogsUseCase.test.ts | Hecho  | `vitest run` (3 unit tests, 7ms)            | 2026-06-11 | -   |
| 5          | infra             | Unit        | EnvConfig.test.ts            | Hecho  | `vitest run` (4 unit tests, 61ms)           | 2026-06-11 | -   |
| 5          | infra             | Unit        | CleanupCron.test.ts          | Hecho  | `vitest run` (3 unit tests, 26ms)           | 2026-06-11 | -   |
| 5          | admin             | Integration | AdminFlow.test.ts            | Hecho  | `vitest run` (5 integration tests, 78ms)    | 2026-06-11 | -   |
| 5          | audit             | Integration | AuditFlow.test.ts            | Hecho  | `vitest run` (1 integration test, 28ms)     | 2026-06-11 | -   |
| 5          | infra             | Integration | CleanupDataLifecycle.test.ts | Hecho  | `vitest run` (1 integration test, 13ms)     | 2026-06-11 | -   |
| 5          | ci                | CI          | node.js.yml + scripts ci     | Hecho  | `type:check` + `lint` + `test:ci` + `build` | 2026-06-08 | -   |

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
