interface TabsProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

const tabs = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'suites', label: 'Suites' },
  { id: 'coverage', label: 'Coverage' },
  { id: 'analisis', label: 'Análisis' },
  { id: 'conclusiones', label: 'Conclusiones' },
  { id: 'comandos', label: 'Comandos' },
  { id: 'hallazgos', label: 'Hallazgos' },
]

export function Tabs({ activeTab, onTabChange }: TabsProps) {
  return (
    <nav className="tabs" aria-label="Navegacion de secciones">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}
