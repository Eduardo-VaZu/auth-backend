# Distribucion De Pruebas Backend

Este documento organiza el trabajo de pruebas del backend entre 5 integrantes. La idea es que cada persona tenga un area clara, archivos objetivo, pruebas esperadas y comandos de validacion sin pisarse con los demas.

## Stack De Pruebas

- Runner: `Vitest`
- Unitarias: `tests/**/unit/**/*.test.ts`
- Integracion: `tests/**/integration/**/*.test.ts`
- HTTP integration: `supertest`
- Servicios reales para integracion: `testcontainers` con PostgreSQL y Redis
- CI/CD: `.github/workflows/node.js.yml`

## Estructura Recomendada

```text
tests/
  setup.ts
  tsconfig.json
  test-structure.yml

  modules/
    health/
      unit/
        HealthController.test.ts

    identity/
      domain/unit/
        IdentityDomain.test.ts
      application/unit/
        RegisterUseCase.test.ts
      integration/
        RegisterFlow.test.ts

    access/
      domain/unit/
        AccessDomain.test.ts
      application/unit/
        LoginUseCase.test.ts
        RefreshTokenUseCase.test.ts
        SessionUseCases.test.ts
        Duration.test.ts
      integration/
        LoginFlow.test.ts
        SessionLifecycle.test.ts

    credentials/
      domain/unit/
        CredentialsDomain.test.ts
      application/unit/
        CredentialsUseCases.test.ts
        ParseOneTimeToken.test.ts
      integration/
        CredentialsFlow.test.ts

    admin/
      application/unit/
        AdminUseCases.test.ts
      integration/
        AdminFlow.test.ts

    audit/
      application/unit/
        ListAuditLogsUseCase.test.ts
      integration/
        AuditFlow.test.ts

  integration/support/
    testEnvironment.ts
```

## Distribucion Por Integrante

| Integrante | Area                      | Unitarias                                                                                                                       | Integracion                                                          | Validacion                 |
| ---------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------- |
| 1          | `health` + `identity`     | `HealthController`, `Email`, `User`, `RegisterUseCase`                                                                          | `RegisterFlow`: `/health`, `/auth/register`, `/auth/me`              | `npm run test:unit`        |
| 2          | `access` login/token      | `LoginUseCase`, `RefreshTokenUseCase`, `TokenService`, `duration`                                                               | `LoginFlow`: `/auth/login`, `/auth/refresh`                          | `npm run test:unit`        |
| 3          | `access` sesiones/logout  | `ListSessionsUseCase`, `LogoutUseCase`, `LogoutAllUseCase`, `RevokeSessionUseCase`, `RefreshToken`, `UserSession`               | `SessionLifecycle`: `/auth/sessions`, `/auth/logout`, revoke session | `npm run test:integration` |
| 4          | `credentials`             | `Password`, `parseOneTimeToken`, `ChangePasswordUseCase`, `ForgotPasswordUseCase`, `ResetPasswordUseCase`, `VerifyEmailUseCase` | `CredentialsFlow`: forgot/reset/verify email                         | `npm run test:unit`        |
| 5          | `admin` + `audit` + CI/CD | `AdminUseCases`, `ListAuditLogsUseCase`, mappers                                                                                | `AdminFlow`, `AuditFlow`                                             | `npm run pr:check`         |

## Integrante 1: Health E Identity

### Archivos Fuente

- `src/modules/health/HealthController.ts`
- `src/modules/identity/domain/value-objects/Email.ts`
- `src/modules/identity/domain/entities/User.ts`
- `src/modules/identity/application/use-cases/RegisterUseCase.ts`
- `src/modules/identity/infrastructure/controllers/IdentityController.ts`
- `src/modules/identity/infrastructure/routes/identity.routes.ts`

### Archivos De Prueba

- `tests/modules/health/unit/HealthController.test.ts`
- `tests/modules/identity/domain/unit/IdentityDomain.test.ts`
- `tests/modules/identity/application/unit/RegisterUseCase.test.ts`
- `tests/modules/identity/integration/RegisterFlow.test.ts`

### Casos Minimos

- Health responde `200` cuando PostgreSQL y Redis estan disponibles.
- Health responde degradado cuando una dependencia falla.
- Email normaliza minusculas y espacios.
- Email invalido lanza error de validacion.
- User activo puede autenticarse.
- User deshabilitado o eliminado no puede autenticarse.
- Registro exitoso crea usuario y credencial.
- Registro duplicado rechaza el email.

## Integrante 2: Access Login Y Token

### Archivos Fuente

- `src/modules/access/application/use-cases/LoginUseCase.ts`
- `src/modules/access/application/use-cases/RefreshTokenUseCase.ts`
- `src/modules/access/application/utils/duration.ts`
- `src/modules/access/infrastructure/services/TokenService.ts`
- `src/modules/access/infrastructure/routes/auth.routes.ts`
- `src/modules/access/infrastructure/routes/auth.schemas.ts`

### Archivos De Prueba

- `tests/modules/access/application/unit/LoginUseCase.test.ts`
- `tests/modules/access/application/unit/RefreshTokenUseCase.test.ts`
- `tests/modules/access/application/unit/Duration.test.ts`
- `tests/modules/access/integration/LoginFlow.test.ts`

### Casos Minimos

- Login exitoso genera access token y refresh token.
- Login con password incorrecto devuelve rechazo.
- Login con usuario inexistente no filtra informacion sensible.
- Usuario bloqueado o deshabilitado no puede iniciar sesion.
- `durationToSeconds` convierte `s`, `m`, `h`, `d`.
- `durationToSeconds` rechaza formatos invalidos.
- Refresh token valido renueva la sesion.
- Refresh token invalido o revocado falla.

## Integrante 3: Access Sesiones Y Logout

### Archivos Fuente

- `src/modules/access/domain/entities/RefreshToken.ts`
- `src/modules/access/domain/entities/UserSession.ts`
- `src/modules/access/application/use-cases/ListSessionsUseCase.ts`
- `src/modules/access/application/use-cases/LogoutUseCase.ts`
- `src/modules/access/application/use-cases/LogoutAllUseCase.ts`
- `src/modules/access/application/use-cases/RevokeSessionUseCase.ts`
- `src/modules/access/infrastructure/repositories/UserSessionRepository.ts`
- `src/modules/access/infrastructure/repositories/RefreshTokenRepository.ts`

### Archivos De Prueba

- `tests/modules/access/domain/unit/AccessDomain.test.ts`
- `tests/modules/access/application/unit/SessionUseCases.test.ts`
- `tests/modules/access/integration/SessionLifecycle.test.ts`

### Casos Minimos

- Refresh token activo devuelve `true`.
- Refresh token expirado o revocado devuelve `false`.
- Reuso de refresh token se detecta como incidente.
- Sesion activa devuelve `true`.
- Sesion expirada o revocada devuelve `false`.
- Listado de sesiones marca la sesion actual.
- Logout revoca token actual.
- Logout all revoca todas las sesiones del usuario.
- Revocar una sesion impide volver a usarla.

## Integrante 4: Credentials

### Archivos Fuente

- `src/modules/credentials/domain/value-objects/Password.ts`
- `src/modules/credentials/domain/entities/OneTimeToken.ts`
- `src/modules/credentials/domain/entities/UserCredential.ts`
- `src/modules/credentials/application/utils/parseOneTimeToken.ts`
- `src/modules/credentials/application/use-cases/ChangePasswordUseCase.ts`
- `src/modules/credentials/application/use-cases/ForgotPasswordUseCase.ts`
- `src/modules/credentials/application/use-cases/ResetPasswordUseCase.ts`
- `src/modules/credentials/application/use-cases/VerifyEmailUseCase.ts`
- `src/modules/credentials/application/use-cases/ResendVerificationUseCase.ts`
- `src/modules/credentials/application/use-cases/ChangeEmailUseCase.ts`

### Archivos De Prueba

- `tests/modules/credentials/domain/unit/CredentialsDomain.test.ts`
- `tests/modules/credentials/application/unit/ParseOneTimeToken.test.ts`
- `tests/modules/credentials/application/unit/CredentialsUseCases.test.ts`
- `tests/modules/credentials/integration/CredentialsFlow.test.ts`

### Casos Minimos

- Password con longitud valida se acepta.
- Password corta lanza error de validacion.
- One time token valido se parsea correctamente.
- Token sin UUID valido se rechaza.
- Token sin secreto se rechaza.
- Forgot password genera token sin revelar si el usuario existe.
- Reset password cambia credencial con token valido.
- Verify email marca email como verificado con token valido.
- Change password exige password actual correcta.

## Integrante 5: Admin, Audit Y CI/CD

### Archivos Fuente

- `src/modules/admin/application/use-cases/AssignUserRoleUseCase.ts`
- `src/modules/admin/application/use-cases/RevokeUserRoleUseCase.ts`
- `src/modules/admin/application/use-cases/ListUsersUseCase.ts`
- `src/modules/admin/application/use-cases/ListRolesUseCase.ts`
- `src/modules/admin/application/use-cases/ListUserRolesUseCase.ts`
- `src/modules/admin/application/use-cases/GetUserProfileUseCase.ts`
- `src/modules/admin/application/use-cases/SoftDeleteUserUseCase.ts`
- `src/modules/admin/application/use-cases/UpdateUserStatusUseCase.ts`
- `src/modules/audit/application/use-cases/ListAuditLogsUseCase.ts`
- `.github/workflows/node.js.yml`
- `package.json`
- `vitest.config.mts`

### Archivos De Prueba

- `tests/modules/admin/application/unit/AdminUseCases.test.ts`
- `tests/modules/admin/integration/AdminFlow.test.ts`
- `tests/modules/audit/application/unit/ListAuditLogsUseCase.test.ts`
- `tests/modules/audit/integration/AuditFlow.test.ts`

### Casos Minimos

- Admin asigna rol valido.
- Admin revoca rol valido.
- No se permite dejar usuario sin rol base si esa regla aplica.
- List users respeta filtros y paginacion.
- Soft delete marca usuario eliminado.
- Update status cambia estado permitido.
- Audit logs devuelve eventos paginados.
- Usuario sin permisos no accede a rutas admin/audit.
- CI ejecuta `type:check`, `lint`, `test:unit`, `test:integration` y `build`.

## Reglas De Trabajo

- Cada integrante debe trabajar solo dentro de sus archivos de prueba asignados.
- Las pruebas unitarias no deben usar PostgreSQL ni Redis reales.
- Las pruebas unitarias deben usar mocks o fakes.
- Las pruebas de integracion deben usar `supertest` y `testcontainers`.
- No agregar SonarQube ni Postman.
- No modificar codigo productivo salvo que una prueba revele un bug real y el equipo lo apruebe.
- Cada PR debe incluir los comandos ejecutados y su resultado.

## Comandos Por Tipo

```bash
npm run type:check
npm run lint
npm run test:unit
npm run test:integration
npm run test:coverage
npm run pr:check
```

## Checklist Por Integrante

- Crear archivos de prueba en la ruta asignada.
- Cubrir minimo un caso positivo y un caso negativo por comportamiento.
- Ejecutar `npm run type:check`.
- Ejecutar el comando de pruebas correspondiente.
- Revisar que no se agreguen dependencias nuevas sin necesidad.
- Documentar en el PR que archivos fuente quedaron cubiertos.

## Entrega Esperada

Al finalizar, el equipo debe tener:

- Pruebas unitarias organizadas por modulo.
- Pruebas de integracion organizadas por flujo HTTP.
- CI/CD ejecutando validaciones principales.
- Matriz clara entre archivo fuente y archivo de prueba.
- Base suficiente para subir cobertura de forma incremental.
