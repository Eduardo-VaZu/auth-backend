# Distribucion De Pruebas Backend

Este archivo queda como indice maestro de pruebas.

## Resumen

- Runner: `Vitest`
- Unitarias: `tests/**/unit/**/*.test.ts`
- Integracion: `tests/**/integration/**/*.test.ts`
- HTTP integration: `supertest`
- Integracion con servicios reales: `testcontainers` (PostgreSQL + Redis)
- CI/CD: `.github/workflows/node.js.yml`

## Reglas Globales

- Las pruebas unitarias no deben usar PostgreSQL ni Redis reales.
- Las pruebas unitarias deben usar mocks, fakes o stubs.
- Las pruebas de integracion deben usar `supertest` y `testcontainers`.
- No agregar SonarQube ni Postman.
- Cada PR debe incluir comandos ejecutados, resultados y archivos cubiertos.

## Comandos Globales

```bash
npm run type:check
npm run lint
npm run test:unit
npm run test:integration
npm run test:coverage
npm run pr:check
npm run build
```

## Distribucion Por Integrante

| Integrante | Area | Documento | Validacion principal |
| --- | --- | --- | --- |
| 1 | `health + identity` | `docs/testing/integrante-1-health-identity.md` | `npm run test:unit` |
| 2 | `access login + token` | `docs/testing/integrante-2-access-login-token.md` | `npm run test:unit` |
| 3 | `access sesiones + logout` | `docs/testing/integrante-3-access-sessions-logout.md` | `npm run test:integration` |
| 4 | `credentials + email delivery` | `docs/testing/integrante-4-credentials-email.md` | `npm run test:unit` |
| 5 | `admin + audit + infra + ci` | `docs/testing/integrante-5-admin-audit-infra-ci.md` | `npm run pr:check` |

## Documentacion De Testing

- Indice general: `docs/testing/README.md`
- Tablero de seguimiento: `docs/testing/progreso-tablero.md`
- Integrante 1: `docs/testing/integrante-1-health-identity.md`
- Integrante 2: `docs/testing/integrante-2-access-login-token.md`
- Integrante 3: `docs/testing/integrante-3-access-sessions-logout.md`
- Integrante 4: `docs/testing/integrante-4-credentials-email.md`
- Integrante 5: `docs/testing/integrante-5-admin-audit-infra-ci.md`

## Decision Final

"Decision final: aplicamos politica estricta de verificacion de email (sin login hasta verificar), integramos Brevo como canal oficial de envio de correos, no expondremos tokens en produccion por API, y ejecutaremos limpieza de tokens/sesiones expirados con retencion de logs de auditoria."
