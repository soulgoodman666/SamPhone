import { MODELS } from './constants.js'

const MODEL_INDEX = MODELS.map((name) => ({
  name,
  lower: name.toLowerCase(),
  compact: name.toLowerCase().replace(/[^a-z0-9]/g, ''),
}))

export function canonicalModel(input) {
  if (!input) return ''
  const text = String(input).trim().toLowerCase().replace(/[_/]+/g, ' ').replace(/\s+/g, ' ')
  const compact = text.replace(/[^a-z0-9]/g, '')
  const found = MODEL_INDEX.find((item) => item.lower === text || item.compact === compact)
  return found ? found.name : String(input).trim()
}

export function canonicalStorage(input) {
  if (!input) return ''
  const text = String(input).trim().toLowerCase().replace(/\s+/g, '')
  const match = text.match(/^(\d+)(gb|tb)?$/)
  if (!match) return String(input).trim()
  return match[2] === 'tb' ? `${match[1]}TB` : `${match[1]}GB`
}

export function canonicalRegion(input) {
  if (!input) return ''
  const text = String(input).trim().toLowerCase()
  if (['ibox', 'i box', 'i-box'].includes(text)) return 'iBox'
  if (text.includes('inter') || text.includes('global') || text.includes('ex-inter')) return 'Internasional'
  if (text.includes('tidak diketahui') || text === 'unknown' || text === 'tidak tahu') return 'Tidak diketahui'
  return String(input).trim()
}

export function lockClass(value) {
  const text = String(value || '').trim().toLowerCase()
  if (!text || text.includes('tidak diketahui') || text.includes('unknown') || text.includes('belum')) return 'unknown'
  if (text.includes('rsim') || text.includes('terkunci') || text.includes('locked') || text === 'kunci') return 'restricted'
  if (text.includes('terbuka') || text.includes('unlock') || text.includes('bebas')) return 'open'
  return 'unknown'
}

export function sameIdentity(left, right) {
  return canonicalModel(left?.specs?.model) === canonicalModel(right?.specs?.model)
    && canonicalStorage(left?.specs?.storage) === canonicalStorage(right?.specs?.storage)
    && canonicalRegion(left?.specs?.region) === canonicalRegion(right?.specs?.region)
    && lockClass(left?.specs?.carrier_lock) === lockClass(right?.specs?.carrier_lock)
}
