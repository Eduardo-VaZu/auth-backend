# Integrante 3 - Access Sessions + Logout

## Alcance

- Entidades de sesion/token
- Casos de uso de sesiones y logout
- Repositorios de sesiones y refresh tokens
- Flujo HTTP de ciclo de vida de sesion

## Archivos Fuente

- `src/modules/access/domain/entities/RefreshToken.ts`
- `src/modules/access/domain/entities/UserSession.ts`
- `src/modules/access/application/use-cases/ListSessionsUseCase.ts`
- `src/modules/access/application/use-cases/LogoutUseCase.ts`
- `src/modules/access/application/use-cases/LogoutAllUseCase.ts`
- `src/modules/access/application/use-cases/RevokeSessionUseCase.ts`
- `src/modules/access/infrastructure/repositories/UserSessionRepository.ts`
- `src/modules/access/infrastructure/repositories/RefreshTokenRepository.ts`

## Suites objetivo

- `tests/modules/access/domain/unit/AccessDomain.test.ts`
- `tests/modules/access/application/unit/SessionUseCases.test.ts`
- `tests/modules/access/infrastructure/unit/SessionRepositories.test.ts`
- `tests/modules/access/integration/SessionLifecycle.test.ts`

## Casos completos unitarios

### Entidades

- `RefreshToken.isActive()` y `indicatesReuseIncident()`.
- `UserSession.isActive()`.

### Use cases

- ListSessions:
  - lista activas
  - marca `isCurrent`.
- RevokeSession:
  - revoca sesion valida
  - sesion actual -> bandera para limpiar cookies
  - sesion no encontrada/ajena -> error.
- Logout:
  - idempotente con/sin access token
  - best-effort ante refresh invalido
  - revoca tokens/sesion cuando corresponde.
- LogoutAll:
  - revoca todas las sesiones y refresh tokens
  - blacklist de access actual cuando aplica.

### Repositorios

- Filtrado correcto por `expiresAt` y `revokedAt`.
- Revocacion por user/session/jti.
- `deleteExpired()` elimina lo esperado.

## Casos completos integracion

### SessionLifecycle

- `GET /auth/sessions` autenticado -> `200`.
- `DELETE /auth/sessions/:sessionId` -> `200` y sesion revocada.
- `POST /auth/logout`:
  - funciona y limpia cookies
  - mantiene idempotencia.
- `POST /auth/logout-all` -> `200`.
- Sesion revocada no puede refrescar token.

## Mocks/Fakes/Testcontainers

- Unit: mocks de repositorios y session store.
- Integration: supertest + testcontainers cuando el flujo usa DB/Redis real.

## Comandos

```bash
npm run test:unit
npm run test:integration
```

## Checklist de entrega

- [x] Unit AccessDomain
- [x] Unit SessionUseCases
- [x] Unit SessionRepositories
- [x] Integration SessionLifecycle
- [x] Evidencia de comandos

## Evidencia de comandos

### Pruebas Unitarias

`npm run test:unit`

```bash
 ✓  unit  tests/modules/access/application/unit/SessionUseCases.test.ts (7 tests) 132ms
 ✓  unit  tests/modules/access/domain/unit/AccessDomain.test.ts (9 tests) 46ms
 ✓  unit  tests/modules/access/infrastructure/unit/SessionRepositories.test.ts (10 tests) 77ms

Test Files  17 passed (17)
     Tests  98 passed (98)
```

### Pruebas de Integración

`npm run test:integration`

```bash
 ✓  integration  tests/modules/access/integration/SessionLifecycle.test.ts (6 tests) 193ms

Test Files  7 passed (7)
     Tests  28 passed (28)
```

## Criterio de Done

- Logout y logout-all sin comportamientos no deterministas.
- Revocaciones efectivas en todos los caminos.
