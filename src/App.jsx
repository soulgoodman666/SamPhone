import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { AppDataProvider } from './context/AppDataContext'
import Layout from './components/Layout'
import {
  AssistantPage,
  DashboardPage,
  ListingDetailPage,
  ListingFormPage,
  ListingsPage,
  LoginPage,
  MarketPage,
  OpportunitiesPage,
  PriceHistoryPage,
  ProfitCalculatorPage,
  SettingsPage,
} from './pages'
import { SellPricePage } from './sellPage'

function ApplicationRoutes() {
  const { configured, user, demo, loading } = useAuth()
  if (loading) return <div className="grid min-h-screen place-items-center text-sm text-slate-500">Memuat Samphone Intelligence…</div>
  if ((configured && !user) || (!configured && !demo)) return <LoginPage />

  return (
    <AppDataProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="iklan" element={<ListingsPage />} />
          <Route path="iklan/baru" element={<ListingFormPage />} />
          <Route path="iklan/:id" element={<ListingDetailPage />} />
          <Route path="iklan/:id/edit" element={<ListingFormPage />} />
          <Route path="asisten" element={<AssistantPage />} />
          <Route path="analisis" element={<MarketPage />} />
          <Route path="peluang" element={<OpportunitiesPage />} />
          <Route path="harga-jual" element={<SellPricePage />} />
          <Route path="kalkulator" element={<ProfitCalculatorPage />} />
          <Route path="riwayat" element={<PriceHistoryPage />} />
          <Route path="pengaturan" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AppDataProvider>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ApplicationRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
