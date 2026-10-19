import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import DispatcherPage from './pages/DispatcherPage'
import DriverTrackPage from './pages/DriverTrackPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DispatcherPage />} />
        <Route path="/track" element={<DriverTrackPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
