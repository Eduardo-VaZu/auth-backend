# Postman Sync Workflow

Objetivo: mantener Postman alineado con OpenAPI cada vez que se crea o cambia un endpoint.

Nota Windows/PowerShell:

- si `npm run ...` falla por policy, usar `npm.cmd run ...`.

## Fuente de verdad

- OpenAPI local: `docs/openapi/auth-backend.v1.yaml`
- Spec remoto (principal): `1210b2ab-b12d-4a19-b1d5-cbf28da6eec2`
- Collection remota (principal): `42700275-5823a8cb-3329-4126-9fdc-6fb5e57cfd90`

## Regla del equipo

1. Cambiar endpoint en backend.
2. Actualizar `docs/openapi/auth-backend.v1.yaml` en el mismo cambio.
3. Ejecutar sync de Postman antes de cerrar el PR.

## Comando unico de sync

```bash
npm.cmd run postman:sync
```

Este comando hace:

1. `PATCH /specs/:specId/files/:filePath` con el OpenAPI local.
2. `PUT /collections/:collectionUid/synchronizations?specId=:specId`.
3. Poll del task async hasta `completed` o `failed`.

Script: `scripts/postman-sync.mjs`

## Comando de validacion (sin cambios remotos)

```bash
npm.cmd run postman:sync:check
```

Valida que la collection vinculada al spec este en estado `in-sync`.
Si esta `out-of-sync`, termina con error para bloquear push/PR.

Script: `scripts/postman-sync-check.mjs`

## Hook pre-push recomendado

Instalacion (una sola vez por repo):

```bash
npm.cmd run hooks:install
```

El hook `.githooks/pre-push` ejecuta `npm.cmd run postman:sync:check` y bloquea el push si no esta sincronizado.

## Bloqueo en CI (GitHub Actions)

Workflow incluido:

- `.github/workflows/postman-sync-check.yml`

Este workflow corre en cada Pull Request y ejecuta:

```bash
npm.cmd run postman:sync:check
```

Configuracion requerida en GitHub:

1. Agregar secreto del repo:
   - `POSTMAN_API_KEY`
2. (Opcional) cambiar IDs en el workflow si migramos a otro spec/collection.

Con esto, aunque alguien omita el hook local, CI bloquea el PR si la collection no esta `in-sync`.

## Variables requeridas

- `POSTMAN_API_KEY` (requerida)
- `POSTMAN_SPEC_ID` (opcional, por defecto spec principal)
- `POSTMAN_COLLECTION_UID` (opcional, por defecto collection principal)
- `POSTMAN_SPEC_FILE` (opcional, por defecto `docs/openapi/auth-backend.v1.yaml`)
- `POSTMAN_SPEC_REMOTE_PATH` (opcional, por defecto `index.yaml`)
- `POSTMAN_TASK_POLL_MS` (opcional, por defecto `2000`)
- `POSTMAN_TASK_TIMEOUT_MS` (opcional, por defecto `90000`)

Referencia para extraer IDs: `docs/GUIA_POSTMAN_IDS.md`

## Modo operativo local

- PostgreSQL + Redis en Docker:
  - `npm.cmd run docker:up:d`
- API local:
  - `npm.cmd run dev`

Con esto Postman usa `http://localhost:4000` como `baseUrl`.
