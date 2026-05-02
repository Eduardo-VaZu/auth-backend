# Auth Backend

Backend de autenticación y gestión de sesiones construido con Node.js, Express, TypeScript, PostgreSQL, Redis y Drizzle ORM.

## Descripción General

Este servicio centraliza los flujos de autenticación, verificación de correo, recuperación de credenciales, administración básica de usuarios y auditoría de eventos de seguridad.

El proyecto está orientado a un modelo de autenticación con cookies seguras, rotación de refresh tokens y control explícito de sesiones por usuario.

## Características Principales

- Registro con verificación obligatoria de email.
- Inicio de sesión con `access_token` y `refresh_token` en cookies.
- Rotación de refresh token con detección de reuse.
- Logout idempotente y cierre global de sesiones.
- Recuperación de contraseña con tokens de un solo uso.
- Cambio de email y contraseña con invalidación de sesiones cuando aplica.
- Gestión administrativa de usuarios y roles.
- Auditoría de eventos relevantes de autenticación.
- Limpieza programada de sesiones y tokens expirados.
- Contrato OpenAPI mantenido junto al backend.

## Stack Tecnológico

- Node.js `>=22`
- Express `5`
- TypeScript
- PostgreSQL
- Redis
- Drizzle ORM + Drizzle Kit
- Inversify
- Vitest
- Supertest
- Testcontainers
- ESLint
- Prettier

## Arquitectura

La aplicación está organizada por módulos de dominio y separa responsabilidades en capas de aplicación, infraestructura y utilidades compartidas.

Módulos principales:

- `health`: estado del servicio y dependencias.
- `identity`: registro y datos del usuario autenticado.
- `access`: login, refresh, sesiones y logout.
- `credentials`: verify email, forgot/reset password y cambios de credenciales.
- `admin`: gestión de usuarios y roles.
- `audit`: consulta de eventos de auditoría.

Estructura de alto nivel:

```text
src/
  app.ts
  config/
  container/
  cron/
  infrastructure/
  main/
  modules/
    access/
    admin/
    audit/
    credentials/
    health/
    identity/
  shared/
  types/
docs/
  openapi/
  testing/
tests/
```

## Requisitos

- Node.js `22+`
- npm `10+`
- Docker y Docker Compose recomendados para entorno local

## Puesta en Marcha

1. Instalar dependencias:

```bash
npm ci
```

2. Crear archivo de entorno:

```bash
Copy-Item .env.example .env
```

En Linux o macOS:

```bash
cp .env.example .env
```

3. Levantar PostgreSQL y Redis:

```bash
npm run docker:up:d
```

4. Ejecutar migraciones:

```bash
npm run db:migrate
```

5. Sembrar roles base si corresponde:

```bash
npm run db:seed:roles
```

6. Iniciar el servidor en desarrollo:

```bash
npm run dev
```

Servidor local por defecto: `http://localhost:4000`

## Configuración de Entorno

Variables principales definidas en `.env.example`:

| Variable | Descripción |
|---|---|
| `PORT` | Puerto HTTP del servicio |
| `NODE_ENV` | Entorno de ejecución |
| `CORS_ORIGIN` | Origen permitido para CORS |
| `DATABASE_URL` | Cadena de conexión a PostgreSQL |
| `REDIS_URL` | Cadena de conexión a Redis |
| `ACCESS_TOKEN_SECRET` | Secreto para access tokens |
| `REFRESH_TOKEN_SECRET` | Secreto para refresh tokens |
| `COOKIE_SECRET` | Secreto para firmado de cookies |
| `COOKIE_DOMAIN` | Dominio de cookies |
| `COOKIE_SECURE` | Cookies solo por HTTPS |
| `COOKIE_SAME_SITE` | Política `SameSite` |
| `MAX_SESSIONS_PER_USER` | Límite de sesiones por usuario |
| `EXPIRED_SESSION_RETENTION_SECONDS` | Retención de sesiones expiradas antes de purga |
| `EMAIL_DELIVERY_MODE` | `preview` o `brevo` |
| `BREVO_API_KEY` | API key de Brevo |
| `BREVO_SENDER_EMAIL` | Correo remitente |
| `BREVO_SENDER_NAME` | Nombre remitente |

Notas operativas:

- En `development` y `test`, con `EMAIL_DELIVERY_MODE=preview`, algunos endpoints pueden devolver `previewToken` para facilitar pruebas.
- En `production`, el envío de email debe operar con Brevo y los tokens sensibles no se exponen por API.

## Scripts Disponibles

| Script | Descripción |
|---|---|
| `npm run dev` | Inicia el servidor en desarrollo |
| `npm run dev:local` | Levanta servicios locales y arranca desarrollo |
| `npm run build` | Compila TypeScript a `dist/` |
| `npm run start` | Ejecuta la build de producción |
| `npm run type:check` | Verifica tipos con TypeScript |
| `npm run lint` | Ejecuta ESLint |
| `npm run lint:fix` | Corrige problemas autofixables de lint |
| `npm run format` | Formatea el repositorio con Prettier |
| `npm run format:check` | Verifica formato |
| `npm run db:generate` | Genera artefactos de Drizzle |
| `npm run db:migrate` | Ejecuta migraciones |
| `npm run db:migrate:legacy-credentials` | Ejecuta migración de datos heredados |
| `npm run db:seed:roles` | Inserta roles base |
| `npm run db:studio` | Abre Drizzle Studio |
| `npm run test` | Ejecuta todos los tests |
| `npm run test:unit` | Ejecuta pruebas unitarias |
| `npm run test:integration` | Ejecuta pruebas de integración |
| `npm run test:unit:ci` | Pruebas unitarias en modo CI |
| `npm run test:integration:ci` | Pruebas de integración en modo CI |
| `npm run test:ci` | Suite de pruebas usada por CI |
| `npm run test:coverage` | Cobertura de pruebas unitarias |
| `npm run pr:check` | Validación local previa a PR |
| `npm run docker:build` | Construye la imagen Docker |
| `npm run docker:up:d` | Levanta PostgreSQL y Redis |
| `npm run docker:up:full` | Levanta la aplicación completa con Docker |
| `npm run docker:down` | Detiene y elimina recursos Docker |

## Docker

El archivo `compose.yaml` define tres servicios:

- `postgres`: PostgreSQL 16.
- `redis`: Redis 7.
- `app`: backend completo bajo el perfil `fullstack`.

Comandos habituales:

```bash
npm run docker:up:d
npm run docker:up:full
npm run docker:down
```

## Pruebas y Calidad

Convenciones actuales:

- Pruebas unitarias: `tests/**/unit/**/*.test.ts`
- Pruebas de integración: `tests/**/integration/**/*.test.ts`
- Integración HTTP: `supertest`
- Dependencias reales para integración: `testcontainers`

Secuencia recomendada antes de abrir un PR:

```bash
npm run type:check
npm run lint
npm run test:unit
npm run test:integration
npm run pr:check
npm run build
```

## Documentación

### OpenAPI

- Especificación principal: `docs/openapi/auth-backend-authentication-api.v1.yaml`
- Guía de mantenimiento del contrato: `docs/openapi/README.md`

### Testing

- Índice general: `docs/testing/README.md`
- Tablero de seguimiento: `docs/testing/progreso-tablero.md`
- Planes por integrante:
  - `docs/testing/integrante-1-health-identity.md`
  - `docs/testing/integrante-2-access-login-token.md`
  - `docs/testing/integrante-3-access-sessions-logout.md`
  - `docs/testing/integrante-4-credentials-email.md`
  - `docs/testing/integrante-5-admin-audit-infra-ci.md`

## Comportamientos de Seguridad Relevantes

- El registro no inicia sesión automáticamente: primero exige verificación de email.
- `POST /auth/logout` está diseñado como endpoint público e idempotente.
- Los refresh tokens rotan y pueden disparar invalidación defensiva ante reuse.
- Los flujos sensibles de credenciales invalidan sesiones cuando corresponde.
- Los logs de auditoría se conservan para trazabilidad operativa.

## Contribución

1. Crear una rama a partir de `main`.
2. Implementar el cambio con alcance acotado.
3. Actualizar pruebas y documentación si el comportamiento visible cambia.
4. Ejecutar `npm run pr:check`.
5. Abrir el PR usando `.github/pull_request_template.md`.

## Estado del Proyecto

El backend cuenta con documentación de contrato OpenAPI, validaciones de CI para tipos, lint y pruebas, y una estructura modular preparada para extender flujos de autenticación sin acoplar la lógica de dominio a la capa HTTP.
