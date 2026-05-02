# Testing Docs

Este directorio divide la ejecucion de pruebas por integrante para evitar un documento unico gigante.

## Indice

- Integrante 1 (Health + Identity):
  - `docs/testing/integrante-1-health-identity.md`
- Integrante 2 (Access Login + Token):
  - `docs/testing/integrante-2-access-login-token.md`
- Integrante 3 (Access Sessions + Logout):
  - `docs/testing/integrante-3-access-sessions-logout.md`
- Integrante 4 (Credentials + Email):
  - `docs/testing/integrante-4-credentials-email.md`
- Integrante 5 (Admin + Audit + Infra + CI):
  - `docs/testing/integrante-5-admin-audit-infra-ci.md`

## Seguimiento

- Tablero compartido:
  - `docs/testing/progreso-tablero.md`

## Reglas globales (resumen)

- Unitarias:
  - `tests/**/unit/**/*.test.ts`
- Integracion:
  - `tests/**/integration/**/*.test.ts`
- Runner:
  - `Vitest`
- Integracion HTTP:
  - `supertest`
- Integracion con servicios reales:
  - `testcontainers` (PostgreSQL + Redis)

## Comandos globales

```bash
npm run type:check
npm run lint
npm run test:unit
npm run test:integration
npm run test:coverage
npm run pr:check
npm run build
```
