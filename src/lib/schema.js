import { z } from 'zod'
import { parseBattery, parsePrice } from './format.js'
import { isHttpUrl } from './url.js'

const optionalText = z.preprocess(
  (value) => (value == null ? '' : String(value)),
  z.string(),
)

const optionalMoney = z.preprocess((value) => {
  if (value == null || String(value).trim() === '') return null
  return parsePrice(value)
}, z.number({ invalid_type_error: 'Masukkan angka yang valid' }).nonnegative('Harga tidak boleh negatif').nullable())

const optionalBattery = z.preprocess((value) => {
  if (value == null || String(value).trim() === '') return null
  return parseBattery(value)
}, z.number({ invalid_type_error: 'Kesehatan baterai tidak valid' }).min(0, 'Minimal 0').max(100, 'Maksimal 100').nullable())

const nullableText = z.preprocess((value) => {
  if (value == null || value === '') return null
  return String(value)
}, z.string().nullable())

const nullableNumber = z.preprocess((value) => {
  if (value == null || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : Number.NaN
  return parsePrice(value)
}, z.number().nonnegative().nullable())

const nullableBattery = z.preprocess((value) => {
  if (value == null || value === '') return null
  return parseBattery(value)
}, z.number().min(0).max(100).nullable())

const nullableBoolish = z.preprocess((value) => {
  if (value == null || value === '') return null
  if (typeof value === 'boolean') return value
  return String(value)
}, z.union([z.boolean(), z.string()]).nullable())

export const listingFormSchema = z.object({
  source_platform: z.enum(['facebook_marketplace', 'facebook_group', 'other'], {
    errorMap: () => ({ message: 'Pilih sumber iklan' }),
  }),
  listing_url: z.string().trim().refine((value) => isHttpUrl(value), 'URL harus diawali http:// atau https://'),
  title: optionalText,
  description: optionalText,
  asking_price: optionalMoney,
  listing_date: optionalText,
  collected_date: optionalText,
  status: z.enum(['active', 'negotiating', 'sold', 'unavailable', 'archived']),
  model: optionalText,
  storage: optionalText,
  color: optionalText,
  region: optionalText,
  battery_health: optionalBattery,
  battery_replaced: optionalText,
  face_id: optionalText,
  true_tone: optionalText,
  carrier_lock: optionalText,
  imei_status: optionalText,
  icloud_status: optionalText,
  parts_history: optionalText,
  physical_condition: optionalText,
  functional_condition: optionalText,
  repair_history: optionalText,
  province: optionalText,
  city: optionalText,
  district: optionalText,
  seller_notes: optionalText,
  internal_notes: optionalText,
  negotiation_notes: optionalText,
  actual_purchase_price: optionalMoney,
  actual_resale_price: optionalMoney,
  missing_fields: z.array(z.string()).optional().default([]),
  uncertain_fields: z.array(z.string()).optional().default([]),
}).superRefine((value, context) => {
  const hasAnchor = value.title.trim() || value.model.trim() || value.listing_url.trim() || value.asking_price != null
  if (!hasAnchor) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['title'],
      message: 'Isi minimal judul, model, URL, atau harga penawaran.',
    })
  }
})

export const extractionSchema = z.object({
  model: nullableText.optional(),
  storage: nullableText.optional(),
  color: nullableText.optional(),
  asking_price: nullableNumber.optional(),
  battery_health: nullableBattery.optional(),
  region: nullableText.optional(),
  city: nullableText.optional(),
  district: nullableText.optional(),
  face_id: nullableBoolish.optional(),
  true_tone: nullableBoolish.optional(),
  carrier_lock: nullableText.optional(),
  imei_status: nullableText.optional(),
  icloud_status: nullableText.optional(),
  battery_status: nullableText.optional(),
  parts_history: nullableText.optional(),
  physical_condition: nullableText.optional(),
  functional_condition: nullableText.optional(),
  repair_history: nullableText.optional(),
  seller_notes: nullableText.optional(),
  title: nullableText.optional(),
  missing_fields: z.array(z.string()).optional().default([]),
  uncertain_fields: z.array(z.string()).optional().default([]),
}).passthrough()

export function formatZodError(error) {
  return error.issues.map((issue) => {
    const path = issue.path.join('.') || 'data'
    return `${path}: ${issue.message}`
  })
}

export function extractJson(text) {
  let source = String(text || '').trim()
  if (!source) throw new Error('JSON masih kosong.')
  if (source.startsWith('```')) {
    source = source.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '')
  }
  try {
    return JSON.parse(source)
  } catch {
    const start = source.search(/[\[{]/)
    const end = Math.max(source.lastIndexOf('}'), source.lastIndexOf(']'))
    if (start >= 0 && end > start) return JSON.parse(source.slice(start, end + 1))
    throw new Error('JSON tidak dapat dibaca. Tempelkan objek JSON dari ChatGPT tanpa teks tambahan.')
  }
}

export function parseExtractionInput(text) {
  const value = extractJson(text)
  const items = Array.isArray(value)
    ? value
    : Array.isArray(value?.listings)
      ? value.listings
      : [value]
  if (!items.length) throw new Error('Tidak ada data di dalam JSON.')
  return items.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { index, ok: false, errors: ['Setiap data harus berupa objek JSON.'] }
    }
    const parsed = extractionSchema.safeParse(item)
    if (!parsed.success) return { index, ok: false, errors: formatZodError(parsed.error), raw: item }
    return { index, ok: true, data: parsed.data }
  })
}
