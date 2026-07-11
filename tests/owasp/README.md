# Pruebas OWASP

Esta carpeta reúne pruebas de integración que **simulan a un atacante** contra endpoints y flujos reales del backend. Cada prueba corresponde a una vulnerabilidad concreta que fue introducida deliberadamente en la rama `owasp-vulnerable-demo`.

**Estado esperado en la punta de la rama:** las nueve pruebas OWASP fallan. Su fallo es la evidencia de que la vulnerabilidad existe. Cuando se apliquen las correcciones propuestas en `docs/owasp/`, las pruebas pasarán a verde.

## Objetivo general

Verificar propiedades de seguridad de flujos críticos:

- `POST /auth/login`
- `POST /auth/register`
- `POST /auth/logout` + `POST /auth/refresh`
- `PATCH /auth/me/email`
- `DELETE /admin/users/:userId`
- `GET /admin/users?q=` (búsqueda)
- Configuración CORS del pipeline HTTP
- Configuración de `trust proxy`
- Coherencia entre auditoría y estado en base de datos

Cada prueba se corre sobre PostgreSQL y Redis reales levantados por Testcontainers, y afirma la propiedad de seguridad tanto vía la respuesta HTTP como vía consulta directa a la base de datos.

## Estructura

- `tests/owasp/integration/LoginUserEnumeration.test.ts` — A07
- `tests/owasp/integration/RegisterMassAssignment.test.ts` — A04/A08
- `tests/owasp/integration/IdorChangeEmail.test.ts` — A01
- `tests/owasp/integration/BrokenAccessControlAdmin.test.ts` — A01
- `tests/owasp/integration/LogoutRefreshReplay.test.ts` — A02
- `tests/owasp/integration/CorsOriginAllowlist.test.ts` — A05
- `tests/owasp/integration/TrustedProxyIpSpoofing.test.ts` — A07 (variante)
- `tests/owasp/integration/AuditInsideTransaction.test.ts` — A09
- `tests/owasp/integration/SqlInjectionAdminSearch.test.ts` — A03

Ver `docs/owasp/` para las fichas de cada hallazgo, incluyendo analogía, impacto y propuesta de corrección.

## Requisitos de ejecución

- Docker corriendo (Testcontainers levanta PostgreSQL 16 y Redis 7).
- Node 22+.
- Cada prueba es autónoma: crea su propio Postgres + Redis con migraciones frescas. No comparte estado con el resto de la suite.

## Comandos

```bash
# Correr las nueve pruebas OWASP
npm run test:integration -- tests/owasp/integration/

# Correr una sola prueba
npm run test:integration -- tests/owasp/integration/LoginUserEnumeration.test.ts
```
