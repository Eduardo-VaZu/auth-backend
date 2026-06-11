import { useState } from 'react'
import { Hero } from './components/Hero'
import { StatsGrid } from './components/StatsGrid'
import { Tabs } from './components/Tabs'
import { SummaryTab } from './components/SummaryTab'
import { SuitesTab } from './components/SuitesTab'
import { CoverageTab } from './components/CoverageTab'
import { AnalysisTab } from './components/AnalysisTab'
import { ConclusionsTab } from './components/ConclusionsTab'
import { CommandsTab } from './components/CommandsTab'
import { FindingsTab } from './components/FindingsTab'
import { useTheme } from './hooks/useTheme'
import { useData } from './hooks/useData'
import './App.css'

function App() {
  const { theme, toggleTheme } = useTheme()
  const { data } = useData()
  const [activeTab, setActiveTab] = useState('resumen')

  const renderTab = () => {
    switch (activeTab) {
      case 'resumen':
        return <SummaryTab data={data} />
      case 'suites':
        return <SuitesTab data={data} />
      case 'coverage':
        return <CoverageTab data={data} />
      case 'analisis':
        return <AnalysisTab data={data} />
      case 'conclusiones':
        return <ConclusionsTab />
      case 'comandos':
        return <CommandsTab data={data} />
      case 'hallazgos':
        return <FindingsTab data={data} />
      default:
        return <SummaryTab data={data} />
    }
  }

  return (
    <main className="page">
      <Hero
        theme={theme}
        onToggleTheme={toggleTheme}
        runState={data.runState}
        updatedAt={data.generatedAt}
        totalSuites={data.summary.total}
      />
      <StatsGrid summary={data.summary} />
      <Tabs activeTab={activeTab} onTabChange={setActiveTab} />
      {renderTab()}
    </main>
  )
}

export default App
