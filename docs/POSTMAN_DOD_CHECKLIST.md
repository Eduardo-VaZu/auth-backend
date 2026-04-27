# Definition of Done (API + Postman)

Usar este checklist en cada PR que cree o modifique endpoints.

## 1) Backend

- [ ] Endpoint implementado en `src/**/routes` + `controller/use-case` segun arquitectura.
- [ ] Validaciones de request actualizadas (Zod).
- [ ] Manejo de errores y codigos HTTP coherentes.

## 2) OpenAPI (fuente de verdad)

- [ ] Actualizado `docs/openapi/auth-backend.v1.yaml`.
- [ ] Path, method, params, body y responses reflejan el cambio real.
- [ ] Si endpoint usa cookies auth, esta documentado en `securitySchemes/security`.

## 3) Sync con Postman

- [ ] Ejecutado `npm.cmd run postman:sync`.
- [ ] El script termina sin error (`Done.`).
- [ ] Ejecutado `npm.cmd run postman:sync:check` y en estado `in-sync`.
- [ ] Endpoint nuevo/modificado visible en la collection final.

## 4) Verificacion minima

- [ ] `npm.cmd run type:check` en verde.
- [ ] `npm.cmd run lint` en verde.
- [ ] Smoke manual del endpoint (200/4xx esperado).

---

## IDs oficiales actuales (V1)

- `specId`: `1210b2ab-b12d-4a19-b1d5-cbf28da6eec2`
- `collectionUid`: `42700275-5823a8cb-3329-4126-9fdc-6fb5e57cfd90`
