# Pruebas OWASP

Carpeta temporal para reunir pruebas OWASP y otros casos de seguridad mientras
se definen sus modulos finales.

Cuando cada caso quede estable, debe moverse a su carpeta duena dentro de
`tests/modules/*`.

## Objetivo General

Estas pruebas validan endurecimiento de autenticacion, sesiones y consultas
sensibles en flujos criticos como:

- `POST /auth/login`
- `POST /auth/refresh`
- `GET /auth/sessions`
- `GET /admin/users`

La idea de esta carpeta es tener casos de seguridad "a la mano" primero y
reubicarlos despues por modulo (`access`, `credentials`, `admin`, etc.).

## Estructura Actual

- `tests/owasp/integration/InjectionProtection.test.ts`
- `tests/owasp/integration/TamperedRefreshCookie.test.ts`
- `tests/owasp/integration/AuthFlowHardening.test.ts`

## Explicacion Completa Por Archivo

### 1. `InjectionProtection.test.ts`

Archivo:
- `tests/owasp/integration/InjectionProtection.test.ts`

Lineas de descripcion:
- `describe`: linea `9`
- `beforeAll`: lineas `12-23`
- `it`: lineas `25-36`

Que hace:
- Levanta la app real con `createApp`.
- Reemplaza Redis por un mock minimo para no depender de infraestructura real.
- Envia un payload malicioso a `POST /auth/login`.
- Verifica que el backend rechace el request con `422`.

Payload probado:
- `email: "admin' OR '1'='1"`
- `password: 'password123'`

Que valida en seguridad:
- Que request no avance al flujo normal de autenticacion.
- Que validacion de esquema corte temprano payloads con formato invalido.
- Que una entrada con patron tipico de inyeccion no termine en `200` ni en login
  exitoso.

Resultado esperado:
- `422 Unprocessable Entity`

Lectura del caso:
- Este test valida rechazo por esquema, no una inyeccion SQL profunda contra
  persistencia.
- Sirve como primera barrera de hardening en `login`.

Comando:

```bash
npm.cmd run test:integration -- tests/owasp/integration/InjectionProtection.test.ts
```

### 2. `TamperedRefreshCookie.test.ts`

Archivo:
- `tests/owasp/integration/TamperedRefreshCookie.test.ts`

Lineas de descripcion:
- `describe`: linea `23`
- helper `buildTamperedSignedCookieHeader`: lineas `15-21`
- `beforeAll`: lineas `26-36`
- `it`: lineas `38-52`

Que hace:
- Construye una cookie firmada falsa para `refresh_token`.
- Altera el valor firmado cambiando el ultimo caracter de la firma.
- Envia esa cookie alterada a `POST /auth/refresh`.
- Verifica que el backend responda `401`.

Que valida en seguridad:
- Que `cookie-parser` y lectura de `signedCookies` no acepten cookies alteradas.
- Que un atacante no pueda modificar el valor de la cookie y reutilizarla.
- Que backend falle de forma controlada sin emitir nuevas cookies.

Resultado esperado:
- `401 Unauthorized`
- `error.code = UNAUTHORIZED`
- `error.message = Missing refresh token`
- sin cabecera `set-cookie`

Lectura del caso:
- Cuando firma de cookie no es valida, backend no toma ese valor como refresh
  token autentico.
- Eso protege contra manipulacion directa de cookies del lado cliente.

Comando:

```bash
npm.cmd run test:integration -- tests/owasp/integration/TamperedRefreshCookie.test.ts
```

### 3. `AuthFlowHardening.test.ts`

Archivo:
- `tests/owasp/integration/AuthFlowHardening.test.ts`

Lineas de descripcion:
- `describe`: linea `11`
- helpers de datos y setup:
- `getDatabaseDependencies`: lineas `44-50`
- `activateUserByEmail`: lineas `52-56`
- `registerAndActivateUser`: lineas `58-64`
- `grantAdminRoleByEmail`: lineas `66-83`
- `loginAndGetCookies`: lineas `85-100`
- `beforeAll`: lineas `102-137`
- `afterAll`: lineas `139-154`
- `it` login uniforme: lineas `156-181`
- `it` replay de refresh: lineas `183-227`
- `it` inyeccion SQL profunda en admin search: lineas `229-266`

Dependencias:
- Requiere Docker y Testcontainers.
- Usa contenedor PostgreSQL.
- Usa contenedor Redis.

Que hace `beforeAll`:
- Arranca PostgreSQL y Redis en contenedores.
- Inyecta `DATABASE_URL` y `REDIS_URL`.
- Ejecuta migraciones.
- Levanta app real.
- Registra y activa usuario base para escenarios de autenticacion.

Que hacen helpers nuevos:
- `registerAndActivateUser` crea usuarios reales y los deja en estado `active`.
- `grantAdminRoleByEmail` asigna rol `admin` por SQL controlado para pruebas
  reales sobre `GET /admin/users`.
- `loginAndGetCookies` obtiene cookies firmadas reales para no mockear
  autenticacion.

#### Caso 3.1. Login uniforme para usuario inexistente y password incorrecto

Lineas:
- `156-181`

Que hace:
- Envia un login con email existente pero password incorrecto.
- Envia otro login con email inexistente.
- Compara ambos resultados.

Que valida en seguridad:
- Mitiga `user enumeration`.
- Evita que un atacante descubra si una cuenta existe por diferencias de
  respuesta.
- Obliga a que ambos casos regresen mismo status y mismo mensaje.

Resultado esperado:
- ambos requests devuelven `401`
- ambos devuelven `error.code = UNAUTHORIZED`
- ambos devuelven `error.message = Invalid credentials`
- ninguno setea cookies

Lectura del caso:
- Si backend respondiera distinto para "usuario no existe" y "password
  incorrecto", se abriria una via para enumerar cuentas reales.

#### Caso 3.2. Replay de refresh token invalida familia de sesion

Lineas:
- `183-227`

Que hace:
1. Hace login valido.
2. Guarda cookies iniciales.
3. Hace `POST /auth/refresh` con esas cookies y obtiene cookies rotadas.
4. Reutiliza de nuevo cookies viejas.
5. Verifica que replay falle.
6. Intenta usar sesion rotada en `GET /auth/sessions`.
7. Verifica que sesion ya fue invalidada.

Que valida en seguridad:
- Rotacion de refresh token.
- Deteccion de reuse/replay.
- Revocacion de familia de sesion tras incidente.
- Corte de acceso posterior a una senal de compromiso.

Resultado esperado:
- primer refresh valido: `200`
- replay del refresh viejo: `401`
- mensaje del replay: `Refresh token is invalid or expired`
- uso posterior de sesion afectada: `401`
- mensaje posterior: `Session is no longer active`

Lectura del caso:
- Este es uno de los casos mas importantes del set OWASP actual.
- Demuestra que backend no solo rechaza token viejo, sino que tambien invalida
  sesion relacionada despues del incidente.

#### Caso 3.3. Inyeccion SQL profunda en `GET /admin/users?q=...`

Lineas:
- `229-266`

Que hace:
1. Registra y activa un usuario admin real.
2. Le asigna rol `admin` en base de datos.
3. Registra y activa usuarios semilla para la busqueda.
4. Hace login real y obtiene cookies validas.
5. Ejecuta listado base `GET /admin/users?page=1&limit=100`.
6. Ejecuta una busqueda normal con `q=needle.owasp`.
7. Ejecuta una busqueda maliciosa con `q=' OR 1=1 --`.

Payload profundo probado:
- `q: "' OR 1=1 --"`

Que valida en seguridad:
- Que input malicioso atraviese capa HTTP, controlador y use case sin romper
  sistema.
- Que filtro SQL generado por Drizzle siga acotado y no se convierta en
  condicion abierta.
- Que payload no devuelva todos los usuarios ni amplie resultados.
- Que endpoint responda `200` controlado, pero con `0` resultados para la
  busqueda maliciosa.

Resultado esperado:
- listado base: `200`
- busqueda normal: `200` y `total = 1`
- busqueda con payload malicioso: `200`
- payload malicioso devuelve `pagination.total = 0`
- payload malicioso devuelve `users = []`

Lectura del caso:
- Este si es escenario de inyeccion SQL profunda, porque input llega a una
  consulta real de persistencia por `q -> controller -> use case -> repository`.
- La prueba demuestra que backend trata payload como dato de busqueda y no como
  SQL ejecutable.
- Tambien deja evidencia de que caso de `login` cubre validacion temprana,
  mientras este cubre resistencia en capa de consulta.

Comando:

```bash
npm.cmd run test:integration -- tests/owasp/integration/AuthFlowHardening.test.ts
```

## Resumen Rapido De Casos

| Archivo | Caso | Linea `it` | Riesgo cubierto | Resultado esperado |
| --- | --- | --- | --- | --- |
| `InjectionProtection.test.ts` | payload malicioso en login | `25` | entrada maliciosa / validacion temprana | `422` |
| `TamperedRefreshCookie.test.ts` | cookie firmada alterada | `38` | manipulacion de cookie | `401` |
| `AuthFlowHardening.test.ts` | login uniforme | `156` | user enumeration | `401` |
| `AuthFlowHardening.test.ts` | replay de refresh | `183` | refresh token reuse / session family revoke | `401` |
| `AuthFlowHardening.test.ts` | SQLi profunda en admin search | `229` | injection en consulta real / bounded search | `200` con `0` resultados |

## Notas Operativas

- `InjectionProtection` y `TamperedRefreshCookie` usan mock minimo de Redis y
  no requieren Docker.
- `AuthFlowHardening` usa Testcontainers y requiere runtime Docker disponible.
- Esta carpeta es temporal. Cuando casos se estabilicen, deben moverse a sus
  modulos finales.
