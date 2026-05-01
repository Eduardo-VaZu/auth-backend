# Flujo De Trabajo Con Pull Requests

Este proyecto debe trabajarse por ramas y pull requests hacia `main`. El objetivo es que cada cambio pase por revision y por CI antes de integrarse.

## Flujo Diario

1. Actualizar `main`.

```bash
git switch main
git pull origin main
```

2. Crear una rama por tarea.

```bash
git switch -c test/integrante-1-health-identity
```

Usar nombres claros:

- `test/integrante-1-health-identity`
- `test/integrante-2-access-login`
- `test/integrante-3-session-lifecycle`
- `test/integrante-4-credentials`
- `test/integrante-5-admin-audit-ci`

3. Ejecutar validaciones locales antes de subir.

```bash
npm run type:check
npm run lint
npm run test:unit
```

Para pruebas de integracion:

```bash
npm run test:integration
```

4. Subir la rama.

```bash
git push -u origin test/integrante-1-health-identity
```

5. Crear PR hacia `main` en GitHub.

La plantilla de PR se carga desde `.github/pull_request_template.md`.

## Reglas Recomendadas En GitHub

Configurar proteccion de rama para `main` desde GitHub:

- Require a pull request before merging.
- Require approvals.
- Require status checks to pass before merging.
- Require branches to be up to date before merging.
- Do not allow force pushes.
- Do not allow deletions.

Checks recomendados como obligatorios:

- `Type check & Lint`
- `Unit Tests`
- `Integration Tests`
- `Production Build`

## Responsabilidades Por PR

- El PR debe modificar solo el area asignada.
- El PR debe indicar que comandos se ejecutaron.
- El PR debe incluir pruebas para los cambios hechos.
- No se debe hacer merge si CI falla.
- No se debe agregar SonarQube ni Postman.

## Relacion Con Pruebas

La division del equipo y las rutas de pruebas estan documentadas en `TEST_ASSIGNMENTS.md`.

Cada integrante debe crear sus pruebas dentro de su carpeta asignada:

- Unitarias: `tests/**/unit/**/*.test.ts`
- Integracion: `tests/**/integration/**/*.test.ts`

## Checklist Antes De Pedir Review

- [ ] Rama creada desde `main` actualizado.
- [ ] Cambios limitados al area asignada.
- [ ] Pruebas unitarias agregadas o actualizadas.
- [ ] Pruebas de integracion agregadas si el flujo toca HTTP, DB o Redis.
- [ ] `npm run type:check` ejecutado.
- [ ] `npm run lint` ejecutado.
- [ ] `npm run test:unit` ejecutado.
- [ ] `npm run test:integration` ejecutado cuando aplica.
- [ ] PR creado hacia `main`.
