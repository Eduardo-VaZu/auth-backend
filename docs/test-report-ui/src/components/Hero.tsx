import type { Theme } from '../hooks/useTheme'

interface HeroProps {
  theme: Theme
  onToggleTheme: () => void
  runState: string
  updatedAt: string
  totalSuites: number
}

export function Hero({
  theme,
  onToggleTheme,
  runState,
  updatedAt,
  totalSuites,
}: HeroProps) {
  const formatLabel = (status: string) => {
    const labels: Record<string, string> = {
      completed: 'Completada',
      running: 'Ejecutando',
      idle: 'Sin ejecutar',
      failed: 'Fallida',
    }
    return labels[status] || status
  }

  const formatDate = (value: string) => {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString('es-PE')
  }

  return (
    <section className="hero">
      <button
        className="theme-toggle"
        onClick={onToggleTheme}
        aria-label="Cambiar modo"
        title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
      >
        {theme === 'dark' ? '☀' : '☾'}
      </button>
      <h1>Tablero de Pruebas</h1>
      <div className="hero-meta">
        <span className="pill">Estado: {formatLabel(runState)}</span>
        <span className="pill">Actualizado: {formatDate(updatedAt)}</span>
        <span className="pill">Suites detectadas: {totalSuites}</span>
      </div>
    </section>
  )
}
