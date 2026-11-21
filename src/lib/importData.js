import { parseCsv } from './csv.js'
import { formToListing } from './listing.js'
import { parseExtractionInput } from './schema.js'

export function importFromText(text, filename = '') {
  const isCsv = filename.toLowerCase().endsWith('.csv') || looksLikeCsv(text)
  if (isCsv && !text.trim().startsWith('{') && !text.trim().startsWith('[')) {
    return importCsv(text)
  }
  return importJson(text)
}

function importJson(text) {
  let parsed
  try {
    parsed = parseExtractionInput(text)
  } catch (error) {
    return { rows: [], fatal: error.message }
  }
  return {
    fatal: null,
    rows: parsed.map((item) => {
      if (!item.ok) return { ok: false, errors: item.errors, warnings: [] }
      return reviewRecord(item.data, item.index)
    }),
  }
}

function importCsv(text) {
  let records
  try {
    records = parseCsv(text)
  } catch (error) {
    return { rows: [], fatal: error.message }
  }
  if (!records.length) return { rows: [], fatal: 'CSV tidak berisi baris data.' }
  return {
    fatal: null,
    rows: records.map((record, index) => reviewRecord(record, index)),
  }
}

function reviewRecord(record, index) {
  const form = {
    source_platform: normalizeSource(record.source_platform),
    listing_url: record.listing_url || '',
    title: record.title || '',
    description: record.description || '',
    asking_price: record.asking_price ?? '',
    listing_date: dateOnly(record.listing_date),
    collected_date: dateOnly(record.collected_at || record.collected_date),
    status: normalizeStatus(record.status),
    model: record.model || '',
    storage: record.storage || '',
    color: record.color || '',
    region: record.region || '',
    battery_health: record.battery_health ?? '',
    battery_replaced: normalizeBatteryChoice(record.battery_replaced || record.battery_status),
    face_id: record.face_id || '',
    true_tone: record.true_tone || '',
    carrier_lock: record.carrier_lock || '',
    imei_status: record.imei_status || '',
    icloud_status: record.icloud_status || '',
    parts_history: record.parts_history || '',
    physical_condition: record.physical_condition || '',
    functional_condition: record.functional_condition || '',
    repair_history: record.repair_history || '',
    province: record.province || 'Jawa Timur',
    city: record.city || '',
    district: record.district || '',
    seller_notes: record.seller_notes || '',
    internal_notes: record.internal_notes || '',
    negotiation_notes: record.negotiation_notes || '',
    actual_purchase_price: record.actual_purchase_price ?? '',
    actual_resale_price: record.actual_resale_price ?? '',
    missing_fields: Array.isArray(record.missing_fields) ? record.missing_fields : [],
    uncertain_fields: Array.isArray(record.uncertain_fields) ? record.uncertain_fields : [],
  }

  const errors = []
  const warnings = []
  if (form.listing_url && !/^https?:\/\//i.test(form.listing_url)) errors.push('URL harus diawali http:// atau https://')
  if (!form.title && !form.model && !form.listing_url && form.asking_price === '') {
    errors.push('Baris kosong: tidak ada judul, model, URL, atau harga.')
  }
  let listing = null
  try {
    listing = formToListing(form)
  } catch (error) {
    errors.push(error.message)
  }
  if (listing && form.asking_price !== '' && listing.asking_price == null) errors.push('Harga penawaran tidak dapat dibaca.')
  if (listing && !listing.specs.model) warnings.push('Model kosong. Data tetap dapat disimpan, tetapi belum bisa dianalisis.')
  if (listing && !listing.specs.storage) warnings.push('Kapasitas kosong.')
  if (listing && listing.asking_price == null) warnings.push('Harga penawaran kosong.')

  return {
    ok: errors.length === 0,
    index,
    errors,
    warnings,
    listing,
    label: listing?.title || listing?.specs?.model || `Baris ${index + 1}`,
  }
}

function looksLikeCsv(text) {
  const first = text.trim().split(/\r?\n/)[0] || ''
  return first.includes(',') && first.includes('asking_price')
}

function normalizeSource(value) {
  const text = String(value || '').toLowerCase()
  if (text.includes('group') || text.includes('grup')) return 'facebook_group'
  if (text.includes('other') || text.includes('lain')) return 'other'
  return 'facebook_marketplace'
}

function normalizeStatus(value) {
  const text = String(value || '').toLowerCase()
  if (text.includes('negos')) return 'negotiating'
  if (text.includes('sold') || text.includes('terjual')) return 'sold'
  if (text.includes('unavailable') || text.includes('tidak tersedia')) return 'unavailable'
  if (text.includes('arsip') || text.includes('archive')) return 'archived'
  return 'active'
}

function normalizeBatteryChoice(value) {
  const text = String(value || '').toLowerCase()
  if (['ya', 'true', 'yes', 'replaced', 'diganti'].includes(text) || text.includes('ganti')) return 'ya'
  if (['tidak', 'false', 'no', 'original'].includes(text)) return 'tidak'
  return ''
}

function dateOnly(value) {
  if (!value) return ''
  const text = String(value)
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : ''
}
