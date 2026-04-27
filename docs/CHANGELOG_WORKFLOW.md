# Historial de Decisiones y Workflow (Changelog)

Este documento registra los hitos arquitectónicos, cambios de fase y decisiones críticas del flujo de trabajo del proyecto `auth-backend`.

---

## [2026-04-26] Hito: Cierre de V1 y Congelación de Arquitectura

### Estado del Proyecto
- **V1 (Autenticación Core):** Finalizada y verificada.
- **V2 (Features Extendidas / Multi-tenant):** En fase de planificación.

### Decisiones Clave
1. **Freeze de V1:** Los módulos de `auth`, `shared` e `infrastructure/db` entran en modo mantenimiento. No se permiten cambios estructurales sin revisión de arquitectura.
2. **Sincronización Postman Obligatoria:** Se implementa un sistema de IDs (`postman:id`) en los controladores para vincular el código directamente con la colección de Postman.
3. **CI Gate / Pre-push Hook:** Se activa `npm run postman:check` en el `pre-push` hook para garantizar que ningún commit rompa la sincronización con la colección de pruebas.
4. **Validación OpenAPI:** La especificación en `docs/openapi/auth-backend.v1.yaml` se convierte en la fuente de verdad para los contratos de la API.

---

## [2026-04-19] Hito: Normalización de Base de Datos (3FN)

### Cambios Realizados
- Separación de la tabla `users` en `user_credentials`, `user_sessions`, `refresh_tokens`, etc.
- Implementación de `auth_audit_logs` para trazabilidad completa.
- Migración de datos exitosa para preservar usuarios existentes.

---

## [2026-04-11] Hito: Inicialización de Arquitectura Hexagonal

### Decisiones de Diseño
- Adopción de **InversifyJS** para Inyección de Dependencias.
- Estructura de carpetas por módulos (`auth`, `health`).
- Separación estricta entre `domain`, `application` e `infrastructure`.
- Uso de **Drizzle ORM** sobre PostgreSQL.
