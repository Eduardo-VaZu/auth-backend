# OpenAPI Docs

Este directorio contiene la especificacion OpenAPI del backend de autenticacion.

## Archivo Principal

- `docs/openapi/auth-backend-authentication-api.v1.yaml`

## Version Actual

- OpenAPI spec version: `1.0.0`
- Estado: alineada con el comportamiento actual del backend al dia `2026-05-01`

## Changelog De Contrato

### 2026-05-01

- Se actualizo `POST /auth/register` para reflejar:
  - verificacion obligatoria de email
  - sin login automatico
  - respuesta `RegisterResponse`
  - `previewToken` opcional en development/test
- Se actualizo `POST /auth/logout` para documentarlo como logout idempotente sin `security` obligatoria en el contrato.
- Se actualizo `POST /auth/resend-verification` para:
  - recibir `{ email }` en body
  - no requerir autenticacion
  - devolver `previewToken` opcional en modo preview
- Se actualizaron respuestas de:
  - `POST /auth/forgot-password`
  - `PATCH /auth/me/email`
  para reflejar `previewToken` opcional en development/test.
- Se agregaron codigos `422` en endpoints con `validateBody` donde faltaban.
- Se agregaron ejemplos de request/response para los endpoints sensibles del flujo auth.

## Reglas De Sincronizacion

Cada vez que cambie el comportamiento HTTP del backend, actualizar tambien:

1. `docs/openapi/auth-backend-authentication-api.v1.yaml`
2. este archivo `docs/openapi/README.md`
3. pruebas de integracion relacionadas si cambia contrato visible

## Checklist De Actualizacion De Contrato

- Si cambia un request body:
  - actualizar schema en `components.schemas`
  - actualizar ejemplo del request
- Si cambia una response:
  - actualizar schema de response
  - actualizar status codes
  - actualizar examples de response
- Si cambia autenticacion/autorizacion:
  - revisar `security`
  - revisar `401/403`
- Si cambia comportamiento solo de development/test:
  - documentar claramente que aplica solo a `preview` o entorno no productivo

## Endpoints Mas Sensibles A Regresion

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `POST /auth/verify-email`
- `POST /auth/resend-verification`
- `PATCH /auth/me/email`
- `GET /auth/sessions`
- `DELETE /auth/sessions/{sessionId}`

## Fuente De Verificacion

La especificacion debe contrastarse contra:

- `src/app.ts`
- `src/modules/**/infrastructure/routes/*.ts`
- `src/modules/**/infrastructure/controllers/*.ts`
- `src/modules/**/application/dtos/*.ts`
- `src/shared/errors/*.ts`

## Nota Operativa

Los ejemplos con `previewToken` representan comportamiento de `development/test` con `EMAIL_DELIVERY_MODE=preview`.
En produccion, los tokens no deben exponerse por API.
