# Tablero de Pruebas - React UI

Tablero interactivo para visualizar resultados de pruebas del proyecto `auth-backend`. Construido con **React + TypeScript + Vite**.

## Estructura

```
docs/test-report-ui/
├── scripts/            # Scripts generadores de datos
│   ├── generate.mjs    # Genera data.js ejecutando todas las pruebas
│   └── clean.mjs       # Limpia data.js
├── src/
│   ├── components/     # Componentes React
│   │   ├── Hero.tsx
│   │   ├── StatsGrid.tsx
│   │   ├── Tabs.tsx
│   │   ├── SummaryTab.tsx
│   │   ├── SuitesTab.tsx
│   │   ├── CoverageTab.tsx
│   │   ├── AnalysisTab.tsx
│   │   ├── ConclusionsTab.tsx
│   │   ├── CommandsTab.tsx
│   │   └── FindingsTab.tsx
│   ├── hooks/          # Custom hooks
│   │   ├── useTheme.ts
│   │   ── useData.ts
│   ├── types.ts        # Tipos TypeScript
│   ├── App.tsx
│   ├── App.css
│   └── main.tsx
└── public/
    └── data.js         # Datos generados (actualizado automáticamente)
```

## Requisitos

- Node.js >= 18
- npm >= 9

## Instalación

```bash
cd docs/test-report-ui
npm install
```

## Flujo de Trabajo

### 1. Ejecutar Pruebas y Generar Datos

Desde la raíz del proyecto (`auth-backend/`):

```bash
# Generar data.js con resultados de pruebas
npm run test:report:dynamic
```

Este comando:
- Ejecuta `type:check`
- Ejecuta cada suite de pruebas individualmente
- Ejecuta `test:coverage`
- Genera `docs/test-report-ui/public/data.js` automáticamente

### 2. Visualizar el Tablero

#### Modo Desarrollo (con hot reload)

```bash
npm run dashboard:dev
```

Abrir http://localhost:5173/ en el navegador.

**Características del modo desarrollo:**
- Hot reload automático al cambiar código
- Datos se recargan cada 3 segundos desde `public/data.js`
- Modo oscuro/claro persistente en localStorage

#### Modo Producción (build estático)

```bash
npm run dashboard:build
```

Esto genera `docs/test-report-ui/dist/` con archivos estáticos optimizados.

Para servir localmente:

```bash
npm run dashboard:preview
```

## Scripts Disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run dashboard:dev` | Inicia servidor de desarrollo en http://localhost:5173/ |
| `npm run dashboard:build` | Genera build de producción en `dist/` |
| `npm run dashboard:preview` | Sirve el build de producción localmente |
| `npm run test:report:dynamic` | Genera data.js ejecutando todas las pruebas |
| `npm run test:report:clean` | Limpia data.js |

## Pestañas del Tablero

### Resumen
- Estado general de ejecución
- Gráfico de distribución de suites (aprobadas/fallidas/pendientes)
- Gráfico de cobertura global (statements/branches/functions/lines)

### Suites
- Tabla completa de suites detectadas
- Filtros por estado (Todas/Aprobadas/Fallidas/En ejecución/Pendientes)
- Detalles de cada suite (módulo, tipo, resultado, actualizado)

### Coverage
- Tabla de cobertura por archivo
- Glosario de métricas
- Resumen de thresholds

### Análisis
- Tasa de aprobación calculada automáticamente
- Coverage vs thresholds configurados
- Lista de suites fallidas
- Top 5 módulos con menor coverage
- Recomendaciones automáticas

### Conclusiones
- Análisis de cobertura de pruebas
- Calidad de implementación
- Defectos identificados
- 5 recomendaciones técnicas fundamentadas
- Próximos pasos

### Comandos
- Lista de comandos ejecutados
- Estado de cada comando
- Salida completa (stdout/stderr)

### Hallazgos
- Issues detectados automáticamente
- Contexto del tablero

## Características

### Modo Oscuro/Claro
- Botón de toggle en el header
- Preferencia guardada en localStorage
- Tema por defecto: oscuro

### Actualización Automática
- Datos se recargan cada 3 segundos
- Gráficos se actualizan sin parpadeo
- Detección de cambios en `data.js`

### Responsive Design
- Adaptable a móviles y tablets
- Tablas se transforman en cards en pantallas pequeñas
- Grid flexible para estadísticas

## Arquitectura

### Generación de Datos

```
npm run test:report:dynamic
    ↓
Ejecuta todas las suites
    ↓
Genera docs/test-report-ui/public/data.js
    ↓
React app lee data.js cada 3s
```

### Componentes React

- **Hero**: Header con título, estado y botón de tema
- **StatsGrid**: Cards de estadísticas (total, aprobadas, fallidas, etc.)
- **Tabs**: Navegación entre secciones
- **SummaryTab**: Gráficos y resumen general
- **SuitesTab**: Tabla filtrable de suites
- **CoverageTab**: Tabla de coverage por archivo
- **AnalysisTab**: Análisis automático con recomendaciones
- **ConclusionsTab**: Conclusiones estáticas
- **CommandsTab**: Lista de comandos ejecutados
- **FindingsTab**: Hallazgos y contexto

### Hooks Personalizados

- **useTheme**: Maneja modo oscuro/claro con localStorage
- **useData**: Carga `data.js` dinámicamente y actualiza cada 3s

## Troubleshooting

### El tablero no muestra datos

1. Verificar que `data.js` existe en `public/`:
   ```bash
   ls docs/test-report-ui/public/data.js
   ```

2. Regenerar datos:
   ```bash
   npm run test:report:dynamic
   ```

3. Recargar la página (Ctrl+R)

### Los gráficos no se actualizan

- Verificar que el servidor de desarrollo está corriendo
- Abrir consola del navegador (F12) y revisar errores
- Confirmar que `data.js` se actualizó recientemente

### Modo oscuro no persiste

- Limpiar localStorage del navegador
- Recargar la página

## Contribución

### Agregar nueva pestaña

1. Crear componente en `src/components/NuevaTab.tsx`
2. Agregar en `src/App.tsx` dentro de `renderTab()`
3. Agregar botón en `src/components/Tabs.tsx`

### Modificar estilos

- Editar `src/App.css`
- Variables CSS en `:root` para modo claro
- Variables CSS en `[data-theme="dark"]` para modo oscuro

### Agregar métricas al análisis

- Editar `src/components/AnalysisTab.tsx`
- Agregar lógica de cálculo
- Actualizar recomendaciones automáticas

## Licencia

MIT
