import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { canonicalModel, canonicalRegion, canonicalStorage, lockClass } from './normalize.js'
import { iqrFence, quantile } from './stats.js'

const DEFAULT_STATUSES = ['active', 'negotiating']

export function filterMarketListings(listings, filters) {
  const model = canonicalModel(filters.model)
  const storage = canonicalStorage(filters.storage)
  const region = filters.region && filters.region !== 'campuran' ? canonicalRegion(filters.region) : null
  const statuses = filters.statuses?.length ? filters.statuses : DEFAULT_STATUSES

  return listings.filter((item) => {
    if (!Number.isFinite(item.asking_price)) return false
    if (!statuses.includes(item.status)) return false
    if (!model || canonicalModel(item.specs?.model) !== model) return false
    if (!storage || canonicalStorage(item.specs?.storage) !== storage) return false
    if (region && canonicalRegion(item.specs?.region) !== region) return false
    if (filters.lock === 'open' && lockClass(item.specs?.carrier_lock) !== 'open') return false
    if (filters.lock === 'restricted' && lockClass(item.specs?.carrier_lock) !== 'restricted') return false
    if (filters.city && item.city !== filters.city) return false
    if (filters.batteryMin !== '' && filters.batteryMin != null) {
      if (item.specs?.battery_health == null || item.specs.battery_health < Number(filters.batteryMin)) return false
    }
    if (filters.batteryMax !== '' && filters.batteryMax != null) {
      if (item.specs?.battery_health == null || item.specs.battery_health > Number(filters.batteryMax)) return false
    }
    return true
  })
}

export function findComparables(subject, listings) {
  const model = canonicalModel(subject.specs?.model)
  const storage = canonicalStorage(subject.specs?.storage)
  const region = canonicalRegion(subject.specs?.region)
  const lock = lockClass(subject.specs?.carrier_lock)
  if (!model || !storage || !region || region === 'Tidak diketahui') return []

  return listings.filter((item) => {
    if (item.id === subject.id) return false
    if (!Number.isFinite(item.asking_price)) return false
    if (item.status === 'archived') return false
    if (!['active', 'negotiating', 'sold', 'unavailable'].includes(item.status)) return false
    if (canonicalModel(item.specs?.model) !== model) return false
    if (canonicalStorage(item.specs?.storage) !== storage) return false
    if (canonicalRegion(item.specs?.region) !== region) return false
    if (lockClass(item.specs?.carrier_lock) !== lock) return false
    return true
  })
}

export function applyOutlierFilter(listings) {
  const fence = iqrFence(listings.map((item) => item.asking_price))
  if (!fence) return { listings, removedCount: 0, fence: null }
  const kept = listings.filter((item) => item.asking_price >= fence.lo && item.asking_price <= fence.hi)
  return { listings: kept, removedCount: listings.length - kept.length, fence }
}

export function actualResales(listings, filters) {
  const model = canonicalModel(filters.model)
  const storage = canonicalStorage(filters.storage)
  const region = filters.region && filters.region !== 'campuran' ? canonicalRegion(filters.region) : null
  return listings.filter((item) => {
    if (!Number.isFinite(item.actual_resale_price)) return false
    if (canonicalModel(item.specs?.model) !== model) return false
    if (canonicalStorage(item.specs?.storage) !== storage) return false
    if (region && canonicalRegion(item.specs?.region) !== region) return false
    return true
  })
}

export function dateRange(listings) {
  const times = listings
    .map((item) => new Date(item.collected_at).getTime())
    .filter((time) => Number.isFinite(time))
  if (!times.length) return null
  return { from: new Date(Math.min(...times)), to: new Date(Math.max(...times)) }
}

export function medianByGroup(listings) {
  const groups = new Map()
  listings.forEach((item) => {
    if (!Number.isFinite(item.asking_price) || item.status === 'archived') return
    const model = canonicalModel(item.specs?.model)
    const storage = canonicalStorage(item.specs?.storage)
    if (!model || !storage) return
    const key = `${model} ${storage}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(item.asking_price)
  })
  return [...groups.entries()]
    .map(([name, prices]) => ({ name, median: quantile(prices, 0.5), count: prices.length }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'id'))
}

export function countByCity(listings) {
  const counts = new Map()
  listings.forEach((item) => {
    const city = item.city || 'Tidak diisi'
    counts.set(city, (counts.get(city) || 0) + 1)
  })
  return [...counts.entries()]
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count || a.city.localeCompare(b.city, 'id'))
}

export function countByMonth(listings) {
  const buckets = new Map()
  listings.forEach((item) => {
    const date = new Date(item.collected_at)
    if (Number.isNaN(date.getTime())) return
    const key = format(date, 'yyyy-MM')
    if (!buckets.has(key)) {
      buckets.set(key, { key, label: format(date, 'MMM yyyy', { locale: localeId }), count: 0 })
    }
    buckets.get(key).count += 1
  })
  return [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key))
}
