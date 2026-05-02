# Integrante 2 - Access Login + Token

## Alcance

- Login y refresh
- Duraciones de token
- TokenService y validacion de JWT
- Rutas/schemas de login-refresh

## Archivos Fuente

- `src/modules/access/application/use-cases/LoginUseCase.ts`
- `src/modules/access/application/use-cases/RefreshTokenUseCase.ts`
- `src/modules/access/application/utils/duration.ts`
- `src/modules/access/infrastructure/services/TokenService.ts`
- `src/modules/access/infrastructure/routes/auth.routes.ts`
- `src/modules/access/infrastructure/routes/auth.schemas.ts`

## Suites objetivo

- `tests/modules/access/application/unit/LoginUseCase.test.ts`
- `tests/modules/access/application/unit/RefreshTokenUseCase.test.ts`
- `tests/modules/access/application/unit/Duration.test.ts`
- `tests/modules/access/infrastructure/unit/TokenService.test.ts`
- `tests/modules/access/integration/LoginFlow.test.ts`

## Casos completos unitarios

### LoginUseCase

- Login exitoso crea access/refresh + sesion + auditoria.
- Password incorrecta -> rechazo.
- Usuario inexistente -> mensaje generico.
- Usuario no autenticable -> rechazo.
- Throttle:
  - incrementa intentos
  - bloquea por umbral
  - registra evento
- Limpia lock tras login exitoso.
- Respeta limite de sesiones por usuario.

### RefreshTokenUseCase

- Refresh valido rota token y renueva sesion.
- Refresh expirado/revocado -> rechazo.
- Hash mismatch -> reuse incident.
- Reuse revoca todas las sesiones y tokens.
- Conflicto de rotacion concurrente se maneja correctamente.

### Duration

- Convierte `s`, `m`, `h`, `d`.
- Rechaza formatos invalidos.

### TokenService

- Firma/verifica access token.
- Firma/verifica refresh token.
- Rechaza payload/tokens invalidos.
- `decodeAccessToken` retorna `null` cuando aplica.

## Casos completos integracion

### LoginFlow

- `POST /auth/login`:
  - exitoso -> `200` + cookies auth
  - invalido -> `401`
- `POST /auth/refresh`:
  - valido -> `200` + rotacion de cookies
  - sin cookie -> `401`
  - invalido/revocado -> `401`

## Mocks/Fakes/Testcontainers

- Unit: mocks de repositorios, session store, token service segun caso.
- Integration: supertest, contenedores para DB/Redis si el flujo lo requiere.

## Comandos

```bash
npm run test:unit
npm run test:integration
```

## Checklist de entrega

- [ ] Unit LoginUseCase
- [ ] Unit RefreshTokenUseCase
- [ ] Unit Duration
- [ ] Unit TokenService
- [ ] Integration LoginFlow
- [ ] Evidencia de comandos

## Criterio de Done

- Cobertura de exito + fallo + borde para login/refresh.
- Flujo HTTP estable en integracion.
