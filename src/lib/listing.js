import { todayInput, isoToDateInput, dateInputToIso, emptyToNull, parseBattery, parsePrice } from './format.js'
import { canonicalModel, canonicalRegion, canonicalStorage } from './normalize.js'
import { normalizeListingUrl } from './url.js'

export function emptyForm() {
  return {
    source_platform: 'facebook_marketplace',
    listing_url: '',
    title: '',
    description: '',
    asking_price: '',
    listing_date: '',
    collected_date: todayInput(),
    status: 'active',
    model: '',
    storage: '',
    color: '',
    region: '',
    battery_health: '',
    battery_replaced: '',
    face_id: '',
    true_tone: '',
    carrier_lock: '',
    imei_status: '',
    icloud_status: '',
    parts_history: '',
    physical_condition: '',
    functional_condition: '',
    repair_history: '',
    province: 'Jawa Timur',
    city: '',
    district: '',
    seller_notes: '',
    internal_notes: '',
    negotiation_notes: '',
    actual_purchase_price: '',
    actual_resale_price: '',
    missing_fields: [],
    uncertain_fields: [],
  }
}

export function listingToForm(listing) {
  const specs = listing.specs || {}
  return {
    ...emptyForm(),
    source_platform: listing.source_platform || 'facebook_marketplace',
    listing_url: listing.listing_url || '',
    title: listing.title || '',
    description: listing.description || '',
    asking_price: listing.asking_price ?? '',
    listing_date: listing.listing_date || '',
    collected_date: isoToDateInput(listing.collected_at),
    status: listing.status || 'active',
    model: specs.model || '',
    storage: specs.storage || '',
    color: specs.color || '',
    region: specs.region || '',
    battery_health: specs.battery_health ?? '',
    battery_replaced: boolToChoice(specs.battery_replaced),
    face_id: specs.face_id || '',
    true_tone: specs.true_tone || '',
    carrier_lock: specs.carrier_lock || '',
    imei_status: specs.imei_status || '',
    icloud_status: specs.icloud_status || '',
    parts_history: specs.parts_history || '',
    physical_condition: specs.physical_condition || '',
    functional_condition: specs.functional_condition || '',
    repair_history: specs.repair_history || '',
    province: listing.province || 'Jawa Timur',
    city: listing.city || '',
    district: listing.district || '',
    seller_notes: listing.seller_notes || '',
    internal_notes: listing.internal_notes || '',
    negotiation_notes: listing.negotiation_notes || '',
    actual_purchase_price: listing.actual_purchase_price ?? '',
    actual_resale_price: listing.actual_resale_price ?? '',
    missing_fields: specs.missing_fields || [],
    uncertain_fields: specs.uncertain_fields || [],
  }
}

export function formToListing(form) {
  const model = canonicalModel(form.model) || null
  const storage = canonicalStorage(form.storage) || null
  const city = emptyToNull(form.city)
  const title = emptyToNull(form.title) || [model, storage, city].filter(Boolean).join(' · ') || null
  return {
    source_platform: form.source_platform,
    listing_url: emptyToNull(form.listing_url),
    normalized_url: normalizeListingUrl(form.listing_url),
    title,
    description: emptyToNull(form.description),
    asking_price: moneyOrNull(form.asking_price),
    listing_date: emptyToNull(form.listing_date),
    collected_at: dateInputToIso(form.collected_date),
    status: form.status || 'active',
    province: emptyToNull(form.province) || 'Jawa Timur',
    city,
    district: emptyToNull(form.district),
    seller_notes: emptyToNull(form.seller_notes),
    internal_notes: emptyToNull(form.internal_notes),
    negotiation_notes: emptyToNull(form.negotiation_notes),
    actual_purchase_price: moneyOrNull(form.actual_purchase_price),
    actual_resale_price: moneyOrNull(form.actual_resale_price),
    specs: {
      model,
      storage,
      color: emptyToNull(form.color),
      region: canonicalRegion(form.region) || null,
      battery_health: batteryOrNull(form.battery_health),
      battery_replaced: choiceToBool(form.battery_replaced),
      face_id: mapCondition(form.face_id),
      true_tone: mapCondition(form.true_tone),
      carrier_lock: mapLock(form.carrier_lock),
      imei_status: mapImei(form.imei_status),
      icloud_status: mapIcloud(form.icloud_status),
      parts_history: emptyToNull(form.parts_history),
      physical_condition: emptyToNull(form.physical_condition),
      functional_condition: emptyToNull(form.functional_condition),
      repair_history: emptyToNull(form.repair_history),
      missing_fields: form.missing_fields || [],
      uncertain_fields: form.uncertain_fields || [],
    },
  }
}

export function extractionToForm(data, extras = {}) {
  const batteryStatus = String(data.battery_status || '').toLowerCase()
  return {
    ...emptyForm(),
    source_platform: extras.source_platform || 'facebook_marketplace',
    listing_url: extras.listing_url || '',
    description: extras.description || '',
    title: data.title || '',
    asking_price: data.asking_price ?? '',
    model: canonicalModel(data.model) || '',
    storage: canonicalStorage(data.storage) || '',
    color: data.color || '',
    region: canonicalRegion(data.region) || '',
    city: data.city || '',
    district: data.district || '',
    battery_health: data.battery_health ?? '',
    battery_replaced: batteryStatus.includes('replac') || batteryStatus.includes('ganti')
      ? 'ya'
      : batteryStatus.includes('original')
        ? 'tidak'
        : '',
    face_id: mapCondition(data.face_id),
    true_tone: mapCondition(data.true_tone),
    carrier_lock: mapLock(data.carrier_lock),
    imei_status: mapImei(data.imei_status),
    icloud_status: mapIcloud(data.icloud_status),
    parts_history: data.parts_history || '',
    physical_condition: data.physical_condition || '',
    functional_condition: data.functional_condition || '',
    repair_history: data.repair_history || '',
    seller_notes: data.seller_notes || '',
    missing_fields: data.missing_fields || [],
    uncertain_fields: data.uncertain_fields || [],
    collected_date: todayInput(),
  }
}

export function emptySpecs() {
  return {
    model: null,
    storage: null,
    color: null,
    region: null,
    battery_health: null,
    battery_replaced: null,
    face_id: null,
    true_tone: null,
    carrier_lock: null,
    imei_status: null,
    icloud_status: null,
    parts_history: null,
    physical_condition: null,
    functional_condition: null,
    repair_history: null,
    missing_fields: [],
    uncertain_fields: [],
  }
}

function moneyOrNull(value) {
  if (value == null || value === '') return null
  const number = typeof value === 'number' ? value : parsePrice(value)
  return Number.isFinite(number) ? number : null
}

function batteryOrNull(value) {
  if (value == null || value === '') return null
  const number = typeof value === 'number' ? value : parseBattery(value)
  // Kolom database bertipe integer, jadi bulatkan (87.5 -> 88).
  return Number.isFinite(number) ? Math.round(number) : null
}

function boolToChoice(value) {
  if (value === true) return 'ya'
  if (value === false) return 'tidak'
  return ''
}

function choiceToBool(value) {
  if (value === 'ya') return true
  if (value === 'tidak') return false
  return null
}

function mapCondition(value) {
  if (value == null || value === '') return null
  if (value === true) return 'Berfungsi'
  if (value === false) return 'Bermasalah'
  const text = String(value).trim().toLowerCase()
  if (['true', 'yes', 'ya', 'berfungsi', 'normal', 'works', 'working'].includes(text)) return 'Berfungsi'
  if (['false', 'no', 'tidak', 'bermasalah', 'rusak', 'mati'].includes(text)) return 'Bermasalah'
  if (text.includes('unknown') || text.includes('tidak diketahui')) return 'Tidak diketahui'
  return String(value).trim()
}

function mapLock(value) {
  if (!value) return null
  const text = String(value).trim().toLowerCase()
  if (text === 'unlocked' || text.includes('terbuka') || text.includes('bebas')) return 'Terbuka'
  if (text.includes('rsim')) return 'RSIM'
  if (text === 'locked' || text.includes('terkunci') || text.includes('kunci')) return 'Terkunci'
  if (text.includes('unknown') || text.includes('tidak diketahui')) return 'Tidak diketahui'
  return String(value).trim()
}

function mapImei(value) {
  if (!value) return null
  const text = String(value).trim().toLowerCase()
  if (text === 'registered' || text.includes('terdaftar') && !text.includes('tidak')) return 'Terdaftar'
  if (text === 'unregistered' || text.includes('tidak terdaftar')) return 'Tidak terdaftar'
  if (text.includes('unknown') || text.includes('belum') || text.includes('tidak diketahui')) return 'Belum dicek'
  return String(value).trim()
}

function mapIcloud(value) {
  if (!value) return null
  const text = String(value).trim().toLowerCase()
  if (text.includes('bersih') || text.includes('clean') || text === 'off') return 'Bersih'
  if (text.includes('terkunci') || text.includes('locked') || text === 'on') return 'Terkunci'
  if (text.includes('belum') || text.includes('unknown') || text.includes('tidak diketahui')) return 'Belum dicek'
  return String(value).trim()
}
