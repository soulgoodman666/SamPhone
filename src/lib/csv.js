import { format } from 'date-fns'

export const CSV_COLUMNS = [
  'title',
  'source_platform',
  'listing_url',
  'asking_price',
  'listing_date',
  'collected_at',
  'status',
  'province',
  'city',
  'district',
  'model',
  'storage',
  'color',
  'region',
  'battery_health',
  'battery_replaced',
  'face_id',
  'true_tone',
  'carrier_lock',
  'imei_status',
  'icloud_status',
  'parts_history',
  'physical_condition',
  'functional_condition',
  'repair_history',
  'seller_notes',
  'internal_notes',
  'negotiation_notes',
  'description',
  'actual_purchase_price',
  'actual_resale_price',
]

export function listingsToCsv(listings) {
  const lines = [CSV_COLUMNS.join(',')]
  listings.forEach((listing) => {
    lines.push(CSV_COLUMNS.map((key) => csvCell(flatValue(listing, key))).join(','))
  })
  return lines.join('\r\n')
}

export function templateCsv() {
  return `${CSV_COLUMNS.join(',')}\r\n`
}

export function parseCsv(text) {
  const table = parseCsvTable(text)
  if (!table.length) return []
  const headers = table[0].map((cell) => cell.trim())
  return table.slice(1)
    .filter((row) => row.some((cell) => cell.trim()))
    .map((row) => {
      const record = {}
      headers.forEach((header, index) => {
        record[header] = row[index] ?? ''
      })
      return record
    })
}

export function listingsToExport(listings, source) {
  return {
    exported_at: new Date().toISOString(),
    source,
    notice: 'Harga pada berkas ini adalah harga penawaran yang dikumpulkan, kecuali kolom actual_purchase_price dan actual_resale_price yang diisi manual.',
    listings: listings.map((listing) => ({
      ...listing,
      images: (listing.images || []).map((image) => ({
        id: image.id,
        kind: image.kind,
        path: image.path || null,
      })),
    })),
  }
}

export function downloadText(filename, content, type) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function exportFilename(extension) {
  return `samphone-intelligence-${format(new Date(), 'yyyyMMdd-HHmm')}.${extension}`
}

function flatValue(listing, key) {
  const specs = listing.specs || {}
  if (key in specs) {
    const value = specs[key]
    if (key === 'battery_replaced') {
      if (value === true) return 'ya'
      if (value === false) return 'tidak'
      return ''
    }
    return value ?? ''
  }
  return listing[key] ?? ''
}

function csvCell(value) {
  const text = value == null ? '' : String(value)
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function parseCsvTable(text) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  const source = String(text || '').replace(/^\uFEFF/, '')
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (quoted) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          cell += '"'
          index += 1
        } else quoted = false
      } else cell += character
    } else if (character === '"') quoted = true
    else if (character === ',') {
      row.push(cell)
      cell = ''
    } else if (character === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else if (character !== '\r') cell += character
  }
  if (cell.length || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}
