import { useState, useEffect } from 'react'
import './index.css'

import PinAuth from './components/auth/PinAuth'
import Sidebar from './components/layout/Sidebar'
import Header from './components/layout/Header'
import ToastContainer from './components/common/ToastContainer'
import ResumeLibrary from './components/resume/ResumeLibrary'
import JDMatching from './components/jd/JDMatching'
import MatchHistory from './components/history/MatchHistory'
import Settings from './components/settings/Settings'
import { useToast } from './hooks/useToast'
import { useSettings } from './hooks/useSettings'
import { testSupabaseConnection, getCandidates } from './lib/supabase'

function App() {
  const [authenticated, setAuthenticated] = useState(() => sessionStorage.getItem('recruitai_auth') === 'true')
  const [activeTab, setActiveTab] = useState('resume')
  const [dbConnected, setDbConnected] = useState(null)
  const [totalCandidates, setTotalCandidates] = useState(0)
  const { toasts, toast, removeToast } = useToast()
  const { settings, updateSettings, updateWeights } = useSettings()

  // Test DB on mount
  useEffect(() => {
    if (!authenticated) return
    testSupabaseConnection().then(r => setDbConnected(r.ok))
    getCandidates({ pageSize: 1 }).then(({ count }) => setTotalCandidates(count)).catch(() => {})
  }, [authenticated])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey) {
        if (e.key === 'u' || e.key === 'U') { e.preventDefault(); setActiveTab('resume') }
        if (e.key === 'j' || e.key === 'J') { e.preventDefault(); setActiveTab('jd') }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleLogout = () => {
    if (window.confirm('Log out of RecruitAI? Your session will be cleared.')) {
      sessionStorage.removeItem('recruitai_auth')
      setAuthenticated(false)
    }
  }

  if (!authenticated) {
    return (
      <>
        <PinAuth onAuthenticated={() => setAuthenticated(true)} />
        <ToastContainer toasts={toasts} removeToast={removeToast} />
      </>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <Header onLogout={handleLogout} dbConnected={dbConnected} />
        <main style={{ flex: 1, overflowY: 'auto', background: '#F8FAFC' }}>
          {activeTab === 'resume' && (
            <ResumeLibrary toast={toast} settings={settings} />
          )}
          {activeTab === 'jd' && (
            <JDMatching toast={toast} settings={settings} totalCandidates={totalCandidates} />
          )}
          {activeTab === 'history' && (
            <MatchHistory toast={toast} />
          )}
          {activeTab === 'settings' && (
            <Settings
              settings={settings}
              updateSettings={updateSettings}
              updateWeights={updateWeights}
              toast={toast}
            />
          )}
        </main>
      </div>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  )
}

export default App

