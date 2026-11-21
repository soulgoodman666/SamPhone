import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'
import { DEFAULT_SETTINGS } from '../lib/constants'
import { createLocalRepository, createSupabaseRepository } from '../lib/repository'
import { supabase } from '../lib/supabase'

const AppDataContext = createContext(null)

export function AppDataProvider({ children }) {
  const auth = useAuth()
  const [listings, setListings] = useState([])
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [snapshots, setSnapshots] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const repository = useMemo(() => {
    if (auth.configured && auth.user) return createSupabaseRepository(supabase, auth.user.id)
    if (!auth.configured && auth.demo) return createLocalRepository()
    return null
  }, [auth.configured, auth.demo, auth.user])

  async function reload(repo = repository) {
    if (!repo) {
      setListings([])
      setSnapshots([])
      setSettings(DEFAULT_SETTINGS)
      return
    }
    const data = await repo.loadAll()
    setListings(data.listings)
    setSettings(data.settings)
    setSnapshots(data.snapshots)
  }

  useEffect(() => {
    if (auth.loading) return undefined
    let cancelled = false
    setLoading(true)
    setError('')
    reload(repository)
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [auth.loading, repository])

  async function run(work) {
    setError('')
    try {
      const result = await work()
      await reload()
      return result
    } catch (actionError) {
      setError(actionError.message)
      throw actionError
    }
  }

  const value = {
    mode: repository?.mode || 'none',
    loading: auth.loading || loading,
    error,
    clearError: () => setError(''),
    listings,
    settings,
    snapshots,
    refresh: () => reload(),
    saveSettings: (next) => run(() => repository.saveSettings(next)),
    createListing: (payload) => run(() => repository.createListing(payload)),
    updateListing: (id, payload) => run(() => repository.updateListing(id, payload)),
    setStatus: (id, status) => run(() => repository.setStatus(id, status)),
    deleteListing: (id) => run(() => repository.deleteListing(id)),
    addImage: (listingId, file, kind) => run(() => repository.addImage(listingId, file, kind)),
    deleteImage: (listingId, imageId) => run(() => repository.deleteImage(listingId, imageId)),
    saveSnapshot: (snapshot) => run(() => repository.saveSnapshot(snapshot)),
    importListings: (payloads) => run(() => repository.importListings(payloads)),
    resetDemo: async () => {
      const data = await repository.resetDemo()
      setListings(data.listings)
      setSettings(data.settings)
      setSnapshots(data.snapshots)
    },
  }

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData() {
  const value = useContext(AppDataContext)
  if (!value) throw new Error('useAppData harus dipakai di dalam AppDataProvider')
  return value
}
