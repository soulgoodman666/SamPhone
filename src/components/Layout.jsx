import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  BadgePercent,
  Calculator,
  ChartColumn,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Plus,
  Settings,
  Smartphone,
  Tag,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useAppData } from '../context/AppDataContext'
import { formatDateId } from '../lib/format'
import { Button, cn } from './ui'

const NAV = [
  { to: '/', label: 'Dasbor', icon: LayoutDashboard, end: true },
  { to: '/iklan', label: 'Iklan', icon: Smartphone },
  { to: '/iklan/baru', label: 'Tambah Iklan', icon: Plus, end: true },
  { to: '/asisten', label: 'Asisten ChatGPT', icon: MessageSquareText, end: true },
  { to: '/analisis', label: 'Analisis Pasar', icon: ChartColumn, end: true },
  { to: '/peluang', label: 'Peluang Beli', icon: BadgePercent, end: true },
  { to: '/harga-jual', label: 'Harga Jual', icon: Tag, end: true },
  { to: '/kalkulator', label: 'Kalkulator Laba', icon: Calculator, end: true },
  { to: '/riwayat', label: 'Riwayat Harga', icon: History, end: true },
  { to: '/pengaturan', label: 'Pengaturan', icon: Settings, end: true },
]

export default function Layout() {
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const { user, signOut, configured } = useAuth()
  const { mode, error, clearError } = useAppData()

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="min-h-screen bg-[#f3f5f8]">
      {mode === 'demo' ? (
        <div className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-950">
          Mode demo. Data di halaman ini tersimpan di peramban ini. Angka contoh bukan data pasar nyata dan tidak berasal dari Supabase.
        </div>
      ) : null}
      <Sidebar />
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-slate-950/40" aria-label="Tutup menu" onClick={() => setOpen(false)} />
          <Sidebar mobile onClose={() => setOpen(false)} />
        </div>
      ) : null}
      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-[#f3f5f8]/95 px-4 py-3 backdrop-blur md:px-8">
          <button className="rounded-lg p-2 text-slate-700 lg:hidden" onClick={() => setOpen(true)} aria-label="Buka menu">
            <Menu size={20} />
          </button>
          <p className="text-sm text-slate-500">{formatDateId(new Date())}</p>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-600 sm:inline">
              {configured ? user?.email : 'Pengguna demo'}
            </span>
            <Button variant="ghost" onClick={signOut}>
              <LogOut size={16} />
              Keluar
            </Button>
          </div>
        </header>
        <main className="px-4 py-6 md:px-8 md:py-8">
          {error ? (
            <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              <p>{error}</p>
              <button onClick={clearError} aria-label="Tutup pesan"><X size={16} /></button>
            </div>
          ) : null}
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function Sidebar({ mobile, onClose }) {
  const location = useLocation()
  return (
    <aside className={cn(
      'z-50 flex w-72 flex-col bg-[#0b1c33] text-white',
      mobile ? 'relative h-full' : 'fixed inset-y-0 left-0 hidden lg:flex',
    )}>
      <div className="flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/10">
            <Smartphone size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold">Samphone</p>
            <p className="text-xs text-slate-300">Intelligence</p>
          </div>
        </div>
        {mobile ? <button onClick={onClose} aria-label="Tutup"><X size={18} /></button> : null}
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {NAV.map((item) => {
          const Icon = item.icon
          const active = isItemActive(location.pathname, item)
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition',
                active ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white',
              )}
            >
              <Icon size={18} />
              {item.label}
            </NavLink>
          )
        })}
      </nav>
      <p className="px-5 py-5 text-xs leading-5 text-slate-400">Penggunaan pribadi · Jawa Timur</p>
    </aside>
  )
}

function isItemActive(pathname, item) {
  if (item.to === '/iklan') {
    return pathname === '/iklan' || (/^\/iklan\/.+/.test(pathname) && pathname !== '/iklan/baru')
  }
  if (item.end) return pathname === item.to
  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}
