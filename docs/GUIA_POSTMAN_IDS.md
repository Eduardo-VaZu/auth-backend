# Guia Rapida: Obtener `specId` y `collectionUid` en Postman

Usar esta guia para configurar sync automatico (`postman:sync`).

## IDs oficiales actuales (V1)

- `specId`: `1210b2ab-b12d-4a19-b1d5-cbf28da6eec2`
- `collectionUid`: `42700275-5823a8cb-3329-4126-9fdc-6fb5e57cfd90`

## 1) Como sacar `collectionUid`

Desde URL de coleccion:

```text
https://web.postman.co/workspace/<workspace>/collection/42700275-5823a8cb-3329-4126-9fdc-6fb5e57cfd90?... 
```

Valor usado:

```text
collectionUid = 42700275-5823a8cb-3329-4126-9fdc-6fb5e57cfd90
```

Regla: texto entre `/collection/` y `?`.

## 2) Como sacar `specId`

Abrir Spec en Postman. URL tipo:

```text
https://web.postman.co/workspace/<workspace>/specification/1210b2ab-b12d-4a19-b1d5-cbf28da6eec2/...
```

Valor usado:

```text
specId = 1210b2ab-b12d-4a19-b1d5-cbf28da6eec2
```

## 3) Formato para compartir IDs

```text
specId: <uuid-del-spec>
collectionUid: <ownerId-uuid-de-coleccion>
```

## 4) Verificacion rapida en proyecto

Variables esperadas en `.env`:

- `POSTMAN_API_KEY`
- `POSTMAN_SPEC_ID`
- `POSTMAN_COLLECTION_UID`

Comandos:

```bash
npm.cmd run postman:sync
npm.cmd run postman:sync:check
```

## 5) Seguridad

Si API key se expone en chat/log:

1. revocar key
2. crear key nueva
3. actualizar secreto en GitHub (`POSTMAN_API_KEY`)
