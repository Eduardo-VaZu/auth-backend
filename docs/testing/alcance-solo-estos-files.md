# Alcance Reducido de Pruebas

Este documento lista solo los archivos de pruebas que quieres cubrir, agrupados por persona.

## Valerio

- Unit: `tests/modules/access/application/unit/LoginUseCase.test.ts`
- Integration: `tests/modules/access/integration/LoginFlow.test.ts`

## Ever

- Unit: `tests/modules/access/application/unit/SessionUseCases.test.ts`
- Integration: `tests/modules/access/integration/SessionLifecycle.test.ts`

## Judas

- Unit: `tests/modules/health/unit/HealthController.test.ts`
- Integration: `tests/modules/identity/integration/RegisterFlow.test.ts`

## Yazmin

- Unit: `tests/modules/credentials/infrastructure/unit/AuthEmailService.test.ts`
- Integration: `tests/modules/credentials/integration/CredentialsFlow.test.ts`

## Comandos Sugeridos

```bash
npm run test:unit -- tests/modules/access/application/unit/LoginUseCase.test.ts
npm run test:integration -- tests/modules/access/integration/LoginFlow.test.ts
npm run test:unit -- tests/modules/access/application/unit/SessionUseCases.test.ts
npm run test:integration -- tests/modules/access/integration/SessionLifecycle.test.ts
npm run test:unit -- tests/modules/health/unit/HealthController.test.ts
npm run test:integration -- tests/modules/identity/integration/RegisterFlow.test.ts
npm run test:unit -- tests/modules/credentials/infrastructure/unit/AuthEmailService.test.ts
npm run test:integration -- tests/modules/credentials/integration/CredentialsFlow.test.ts
```

## Nota

Si quieres, también lo convierto en tabla de seguimiento con estado `Pendiente | En curso | Hecho`.
