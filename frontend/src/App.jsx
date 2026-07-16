import { Route, Routes } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { Dashboard } from './pages/Dashboard'
import { IncidentManagement } from './pages/IncidentManagement'
import { IncidentDetails } from './pages/IncidentDetails'
import { LiveMonitoring } from './pages/LiveMonitoring'
import { EvidenceSources } from './pages/EvidenceSources'
import { Analytics } from './pages/Analytics'
import { Reports } from './pages/Reports'
import { Runbooks } from './pages/Runbooks'
import { Settings } from './pages/Settings'
import { Profile } from './pages/Profile'
import { LoginPage } from './pages/LoginPage'
import { ProtectedRoute } from './components/ProtectedRoute'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/incidents" element={<IncidentManagement />} />
          <Route path="/incidents/:id" element={<IncidentDetails />} />
          <Route path="/monitoring" element={<LiveMonitoring />} />
          <Route path="/evidence" element={<EvidenceSources />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/runbooks" element={<Runbooks />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
