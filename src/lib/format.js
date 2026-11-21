import { format, parseISO } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

export function formatRupiah(value) {
  if (value == null || value === '' || Number.isNaN(Number(value))) return '—'
  const rounded = Math.round(Number(value))
  return `Rp${new Intl.NumberFormat('id-ID').format(rounded)}`
}

export function formatPercent(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(value)}%`
}

export function formatDateId(value) {
  if (!value) return '—'
  const date = value instanceof Date ? value : parseISO(String(value).length === 10 ? `${value}T12:00:00` : value)
  if (Number.isNaN(date.getTime())) return '—'
  return format(date, 'd MMMM yyyy', { locale: localeId })
}

export function formatDateTimeId(value) {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return format(date, "d MMMM yyyy, HH.mm", { locale: localeId })
}

export function todayInput() {
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function isoToDateInput(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function dateInputToIso(value) {
  if (!value) return new Date().toISOString()
  const [year, month, day] = String(value).split('-').map(Number)
  if (!year || !month || !day) return new Date().toISOString()
  return new Date(year, month - 1, day, 12, 0, 0).toISOString()
}

/**
 * Parse Indonesian or plain numeric money.
 * Empty input returns null. Unreadable input returns NaN.
 */
export function parsePrice(value) {
  if (value == null) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : Number.NaN
  let text = String(value).trim().toLowerCase()
  if (!text) return null
  text = text.replace(/rp|idr/g, '').replace(/\s/g, '')
  if (!text) return null
  if (!/^[\d.,]+$/.test(text)) return Number.NaN
  if (/^\d{1,3}(\.\d{3})+$/.test(text)) text = text.replace(/\./g, '')
  else if (/^\d{1,3}(,\d{3})+$/.test(text)) text = text.replace(/,/g, '')
  else if (/^\d+,\d{1,2}$/.test(text)) text = text.replace(',', '.')
  else text = text.replace(/\./g, '').replace(/,/g, '')
  const number = Number(text)
  return Number.isFinite(number) ? number : Number.NaN
}

export function parseBattery(value) {
  if (value == null || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : Number.NaN
  const match = String(value).match(/(\d+(?:[.,]\d+)?)/)
  if (!match) return Number.NaN
  const number = Number(match[1].replace(',', '.'))
  return Number.isFinite(number) ? number : Number.NaN
}

export function emptyToNull(value) {
  if (value == null) return null
  const text = String(value).trim()
  return text ? text : null
}
