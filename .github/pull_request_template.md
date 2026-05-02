# Pull Request

## Objetivo

Describe en 1-3 lineas por que existe este PR y que problema resuelve.

## Resumen De Cambios

-
-
-

## Tipo De Cambio

- [ ] Pruebas unitarias
- [ ] Pruebas de integracion
- [ ] Infra / CI/CD
- [ ] Correccion de bug
- [ ] Cambio de contrato API / OpenAPI
- [ ] Refactor sin cambio funcional
- [ ] Documentacion

## Area Responsable

- [ ] Integrante 1: health + identity
- [ ] Integrante 2: access login/token
- [ ] Integrante 3: access sesiones/logout
- [ ] Integrante 4: credentials + email delivery
- [ ] Integrante 5: admin + audit + infra + CI/CD

## Alcance

### Archivos Fuente Principales

-
-

### Archivos De Prueba Agregados O Actualizados

-
-

### Endpoints / Flujos Afectados

- [ ] No aplica
- [ ] `/health`
- [ ] `/auth/register`
- [ ] `/auth/login`
- [ ] `/auth/refresh`
- [ ] `/auth/logout`
- [ ] `/auth/logout-all`
- [ ] `/auth/forgot-password`
- [ ] `/auth/reset-password`
- [ ] `/auth/verify-email`
- [ ] `/auth/resend-verification`
- [ ] `/auth/change-password`
- [ ] `/auth/me`
- [ ] `/auth/me/email`
- [ ] `/auth/sessions`
- [ ] `/admin/*`

## Cobertura De Pruebas

### Unitarias

- [ ] No aplica
- [ ] Se agregaron nuevas unitarias
- [ ] Se actualizaron unitarias existentes

Suites:

-
-

### Integracion

- [ ] No aplica
- [ ] Se agregaron nuevas pruebas de integracion
- [ ] Se actualizaron pruebas de integracion existentes

Suites:

-
-

## Validaciones Ejecutadas

Marca lo ejecutado y agrega un resultado breve.

- [ ] `npm run type:check`
      Resultado:
- [ ] `npm run lint`
      Resultado:
- [ ] `npm run test:unit`
      Resultado:
- [ ] `npm run test:integration`
      Resultado:
- [ ] `npm run pr:check`
      Resultado:
- [ ] `npm run build`
      Resultado:

## Contrato Y Documentacion

- [ ] No aplica
- [ ] Se actualizo `docs/openapi/auth-backend-authentication-api.v1.yaml`
- [ ] Se actualizo `docs/openapi/README.md`
- [ ] Se actualizo documentacion de pruebas (`docs/testing/*`)
- [ ] Se actualizaron ejemplos de `.env` / configuracion

## Riesgos Y Consideraciones

Describe cualquier riesgo tecnico, compatibilidad, migracion manual o comportamiento sensible.

- Riesgo:
- Mitigacion:

## Checklist Final

- [ ] La rama fue creada desde `main` actualizado.
- [ ] El PR se limita al area responsable.
- [ ] Los cambios productivos y las pruebas son coherentes entre si.
- [ ] Si cambie contrato HTTP, actualice OpenAPI.
- [ ] Si cambie flujo critico, agregue o actualice pruebas.
- [ ] No agregue SonarQube.
- [ ] No agregue Postman.
- [ ] Las pruebas unitarias no dependen de PostgreSQL o Redis reales.
- [ ] Las pruebas de integracion usan `supertest` y `testcontainers` cuando aplica.
- [ ] El PR esta listo para review.
