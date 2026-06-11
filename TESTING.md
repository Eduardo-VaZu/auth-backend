# Auth Backend - Tablero de Pruebas

## Quick Start

### 1. Ejecutar Pruebas

```bash
# Instalar dependencias (primera vez)
npm install

# Verificar tipos
npm run type:check

# Ejecutar todas las pruebas
npm run test:all

# O ejecutar por separado
npm run test:unit          # Pruebas unitarias
npm run test:integration   # Pruebas de integración (requiere Docker)
npm run test:coverage      # Generar reporte de coverage
```

### 2. Generar Tablero de Pruebas

```bash
# Generar datos del tablero (ejecuta pruebas y genera data.js)
npm run test:report:dynamic
```

Este comando:
- Ejecuta `type:check`
- Ejecuta cada suite de pruebas individualmente
- Ejecuta `test:coverage`
- Genera `docs/test-report-ui/public/data.js` automáticamente

### 3. Visualizar Tablero

**Versión principal: React UI** (desarrollo diario)

```bash
# Iniciar servidor de desarrollo
npm run dashboard:dev
```

Abrir http://localhost:5173/ en el navegador.

**Ventajas:**
- ✅ Hot reload automático al cambiar código
- ✅ Interfaz más rápida y fluida
- ✅ Arquitectura de componentes (fácil de mantener)
- ✅ TypeScript para mejor DX
- ✅ Datos se actualizan cada 3 segundos

#### Versión HTML Estática (CI/CD y compartir)

El archivo `docs/test-report/index.html` se mantiene como **artifact estático** para:
- Adjuntar en reportes de evaluación
- Compartir sin necesidad de servidor
- CI/CD artifacts
- Visualización rápida sin setup

```bash
# Windows
start docs/test-report/index.html

# macOS
open docs/test-report/index.html

# Linux
xdg-open docs/test-report/index.html
```

**Nota:** Ambas versiones comparten los mismos datos (`data.js`) y se actualizan simultáneamente.

#### Opción C: Build de Producción

```bash
# Generar build estático
npm run dashboard:build

# Servir localmente
npm run dashboard:preview
```

## Flujo Completo

```
1. Ejecutar pruebas
        ↓
   npm run test:all
        ↓
2. Generar datos
        ↓
   npm run test:report:dynamic
        ↓
   Genera docs/test-report/data.js
   Copia a docs/test-report-ui/public/data.js
        ↓
3. Visualizar tablero
        ↓
   npm run dashboard:dev
        ↓
   Abrir http://localhost:5173/
```

## Comandos Disponibles

### Pruebas

| Comando | Descripción |
|---------|-------------|
| `npm run type:check` | Verificar tipos TypeScript |
| `npm run lint` | Ejecutar ESLint |
| `npm run test:unit` | Pruebas unitarias |
| `npm run test:integration` | Pruebas de integración |
| `npm run test:coverage` | Coverage con reporte |
| `npm run test:all` | Ejecutar todo (typecheck + unit + integration + coverage) |
| `npm run pr:check` | Validación completa para PR |

### Tablero

| Comando | Descripción |
|---------|-------------|
| `npm run test:report:dynamic` | Generar datos del tablero |
| `npm run test:report:clean` | Limpiar datos del tablero |
| `npm run dashboard:dev` | Iniciar tablero React en modo desarrollo |
| `npm run dashboard:build` | Generar build de producción del tablero |
| `npm run dashboard:preview` | Servir build de producción localmente |

### Docker

| Comando | Descripción |
|---------|-------------|
| `npm run docker:up:d` | Iniciar PostgreSQL y Redis |
| `npm run docker:up:full` | Iniciar todos los servicios |
| `npm run docker:down` | Detener servicios |
| `npm run dev:local` | Iniciar Docker + servidor de desarrollo |

## Estructura de Pruebas

```
tests/
├── modules/
│   ├── access/          # Módulo de acceso (login, refresh, logout)
│   │   ├── application/unit/
│   │   └── integration/
│   ├── admin/           # Módulo admin (roles, usuarios)
│   ├── audit/           # Módulo de auditoría
│   ├── credentials/     # Módulo de credenciales (password, email)
│   ├── health/          # Health check
│   ── identity/        # Módulo de identidad (registro, usuario)
└── setup.ts             # Configuración global de tests
```

## Requisitos para Pruebas de Integración

Las pruebas de integración requieren Docker:

```bash
# Iniciar servicios
npm run docker:up:d

# Ejecutar pruebas de integración
npm run test:integration

# Detener servicios
npm run docker:down
```

**Servicios necesarios:**
- PostgreSQL (puerto 5432)
- Redis (puerto 6379)

## Tablero de Pruebas - Características

### Pestañas

1. **Resumen**: Estado general, gráficos de suites y coverage
2. **Suites**: Tabla completa de pruebas con filtros
3. **Coverage**: Tabla de cobertura por archivo
4. **Análisis**: Métricas automáticas y recomendaciones
5. **Conclusiones**: Análisis técnico y próximos pasos
6. **Comandos**: Lista de comandos ejecutados
7. **Hallazgos**: Issues detectados

### Funcionalidades

- ✅ Actualización automática cada 3 segundos
- ✅ Modo oscuro/claro persistente
- ✅ Filtros por estado de pruebas
- ✅ Gráficos interactivos (Chart.js)
- ✅ Responsive design
- ✅ Recomendaciones automáticas basadas en thresholds

### Thresholds Configurados

| Métrica | Threshold |
|---------|-----------|
| Statements | 45% |
| Branches | 40% |
| Functions | 40% |
| Lines | 45% |

## Troubleshooting

### Docker no inicia

```bash
# Verificar estado de Docker
docker ps

# Reiniciar servicios
npm run docker:down
npm run docker:up:d
```

### Pruebas de integración fallan

```bash
# Verificar que Docker está corriendo
docker ps

# Verificar puertos disponibles
netstat -an | findstr "5432 6379"

# Reiniciar servicios
npm run docker:down
npm run docker:up:d
```

### Tablero no muestra datos

```bash
# Regenerar datos
npm run test:report:dynamic

# Verificar que data.js existe
ls docs/test-report/data.js
ls docs/test-report-ui/public/data.js

# Reiniciar servidor de desarrollo
npm run dashboard:dev
```

### Coverage bajo

El coverage actual está por debajo de los thresholds configurados. Esto es esperado en etapas tempranas del proyecto.

**Recomendaciones:**
- Agregar tests para domain entities (0% coverage)
- Agregar tests para repositories
- Agregar tests para controllers

## Documentación Adicional

- [Tablero React UI - README](docs/test-report-ui/README.md)
- [Documentación de Testing](docs/testing/README.md)
- [Asignación de Pruebas por Integrante](docs/testing/ASIGNACIONES_PRUEBAS.md)
- [Progreso del Tablero](docs/testing/progreso-tablero.md)

## Contribución

### Agregar nueva suite de pruebas

1. Crear archivo `*.test.ts` en la carpeta correspondiente
2. Ejecutar `npm run test:report:dynamic`
3. La nueva suite aparecerá automáticamente en el tablero

### Modificar thresholds

Editar `docs/test-report/generate.mjs` y actualizar el objeto `thresholds`.

### Agregar nueva pestaña al tablero

Ver [docs/test-report-ui/README.md](docs/test-report-ui/README.md) sección "Contribución".

## Licencia

MIT
