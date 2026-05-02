# Integrante 5 - Admin + Audit + Infra + CI

## Alcance

- Casos de uso admin
- Casos de uso audit
- Configuracion de entorno
- Limpieza cron de artefactos expirados
- Pipeline CI

## Archivos Fuente

- `src/modules/admin/application/use-cases/AssignUserRoleUseCase.ts`
- `src/modules/admin/application/use-cases/RevokeUserRoleUseCase.ts`
- `src/modules/admin/application/use-cases/ListUsersUseCase.ts`
- `src/modules/admin/application/use-cases/ListRolesUseCase.ts`
- `src/modules/admin/application/use-cases/ListUserRolesUseCase.ts`
- `src/modules/admin/application/use-cases/GetUserProfileUseCase.ts`
- `src/modules/admin/application/use-cases/SoftDeleteUserUseCase.ts`
- `src/modules/admin/application/use-cases/UpdateUserStatusUseCase.ts`
- `src/modules/audit/application/use-cases/ListAuditLogsUseCase.ts`
- `src/config/env.ts`
- `src/cron/cleanup.cron.ts`
- `.github/workflows/node.js.yml`
- `package.json`
- `vitest.config.mts`
- `tests/test-structure.yml`
- `tests/setup.ts`
- `tests/tsconfig.json`

## Suites objetivo

- `tests/modules/admin/application/unit/AdminUseCases.test.ts`
- `tests/modules/admin/integration/AdminFlow.test.ts`
- `tests/modules/audit/application/unit/ListAuditLogsUseCase.test.ts`
- `tests/modules/audit/integration/AuditFlow.test.ts`
- `tests/modules/infra/unit/EnvConfig.test.ts`
- `tests/modules/infra/unit/CleanupCron.test.ts`
- `tests/modules/infra/integration/CleanupDataLifecycle.test.ts`

## Casos completos unitarios

### Admin

- Assign role:
  - asigna rol valido
  - evita duplicado
  - revoca sesiones del target cuando aplica.
- Revoke role:
  - revoca rol valido
  - no permite quitar ultimo rol activo.
- Update status:
  - aplica cambios permitidos
  - revoca sesiones/tokens si el estado cambia.
- Soft delete:
  - marca eliminado
  - revoca sesiones/tokens.
- Listados/perfil:
  - filtros, paginacion, mapeo DTO.

### Audit

- Filtros por usuario, actor, requestId, eventType, eventStatus, fechas.
- Paginacion consistente.

### Infra

- `env.ts`:
  - parseo y coercion de env vars
  - produccion exige `EMAIL_DELIVERY_MODE=brevo`
  - modo brevo exige `BREVO_API_KEY` y `BREVO_SENDER_EMAIL`.
- `cleanup.cron.ts`:
  - purga `refresh_tokens` expirados (sin depender de `revokedAt`)
  - purga `user_sessions` expiradas segun retencion configurable
  - logs de conteo y manejo de error.

## Casos completos integracion

### AdminFlow

- Endpoints admin accesibles para admin.
- No-admin recibe `403`.
- Cambios de rol/status/delete reflejan efectos en acceso/sesion.

### AuditFlow

- `/admin/audit-logs` requiere admin.
- Retorna resultados filtrados y paginados.

### CleanupDataLifecycle

- Borra artefactos expirados esperados.
- Conserva artefactos no expirados.

## CI/CD

- Validar que workflow ejecuta:
  - `npm run type:check`
  - `npm run lint`
  - `npm run test:unit:ci`
  - `npm run test:integration:ci`
  - `npm run build`
- Validar que falla si faltan tests en scripts `*:ci`.
- Validar artefacto de cobertura unit.

## Comandos

```bash
npm run pr:check
npm run build
```

## Checklist de entrega

- [ ] Unit AdminUseCases
- [ ] Integration AdminFlow
- [ ] Unit ListAuditLogsUseCase
- [ ] Integration AuditFlow
- [ ] Unit EnvConfig
- [ ] Unit CleanupCron
- [ ] Integration CleanupDataLifecycle
- [ ] Validacion CI completa
- [ ] Evidencia de comandos

## Criterio de Done

- Seguridad de permisos validada.
- Configuracion de entorno robusta.
- Limpieza de expirados comprobada.
- Pipeline reproducible en local y CI.
