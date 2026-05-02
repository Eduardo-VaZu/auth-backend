# Integrante 1 - Health + Identity

## Alcance

- Health checks
- Dominio identity (Email, User)
- Registro estricto con verificacion de email
- Flujo HTTP de registro y /me

## Archivos Fuente

- `src/modules/health/HealthController.ts`
- `src/modules/identity/domain/value-objects/Email.ts`
- `src/modules/identity/domain/entities/User.ts`
- `src/modules/identity/application/use-cases/RegisterUseCase.ts`
- `src/modules/identity/infrastructure/controllers/IdentityController.ts`
- `src/modules/identity/infrastructure/routes/identity.routes.ts`

## Suites objetivo

- `tests/modules/health/unit/HealthController.test.ts`
- `tests/modules/identity/domain/unit/IdentityDomain.test.ts`
- `tests/modules/identity/application/unit/RegisterUseCase.test.ts`
- `tests/modules/identity/integration/RegisterFlow.test.ts`

## Casos completos unitarios

### HealthController

- `200` cuando PostgreSQL y Redis estan ok.
- `503` cuando PostgreSQL falla.
- `503` cuando Redis falla.
- `503` cuando fallan ambos.
- Payload incluye `status`, `timestamp`, `uptime`, `dependencies`.

### Email

- Normaliza espacios y mayusculas.
- Acepta formatos validos.
- Rechaza formatos invalidos.

### User

- `canAuthenticate()`:
  - true solo con `status=active` y `deletedAt=null`.
  - false en `disabled`, `locked`, `pending_verification`, eliminado.
- `primaryRole()` retorna primer rol o fallback `user`.

### RegisterUseCase

- Crea usuario `pending_verification`.
- Crea credencial.
- Invalida tokenes activos previos de verificacion.
- Crea nuevo token y dispara envio de email.
- Devuelve `verificationRequired=true`.
- Rechaza email duplicado.

## Casos completos integracion

### RegisterFlow

- `GET /health` -> `200` con payload esperado.
- `POST /auth/register` -> `201`.
- Registro NO setea cookies de login automatico.
- En dev/test puede devolver `previewToken`.
- `GET /auth/me` sin login despues de registro -> `401`.
- Email duplicado -> `409`.
- Payload invalido -> `400`.

## Mocks/Fakes/Testcontainers

- Unit: mock de repositorios y servicio de email.
- Integration: supertest + app real, dependencias segun entorno de integracion.

## Comandos

```bash
npm run test:unit
npm run test:integration
```

## Checklist de entrega

- [ ] Unit Health
- [ ] Unit Identity domain
- [ ] Unit RegisterUseCase
- [ ] Integration RegisterFlow
- [ ] Evidencia de comandos

## Criterio de Done

- Todos los casos arriba en verde.
- Sin regresion en `npm run pr:check`.
