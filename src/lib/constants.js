export const APP_NAME = 'Samphone Intelligence'

export const MODELS = [
  'iPhone 11',
  'iPhone 11 Pro',
  'iPhone 11 Pro Max',
  'iPhone 12',
  'iPhone 12 mini',
  'iPhone 12 Pro',
  'iPhone 12 Pro Max',
  'iPhone 13',
  'iPhone 13 mini',
  'iPhone 13 Pro',
  'iPhone 13 Pro Max',
  'iPhone 14',
  'iPhone 14 Plus',
  'iPhone 14 Pro',
  'iPhone 14 Pro Max',
  'iPhone 15',
  'iPhone 15 Plus',
  'iPhone 15 Pro',
  'iPhone 15 Pro Max',
  'iPhone 16',
  'iPhone 16 Plus',
  'iPhone 16 Pro',
  'iPhone 16 Pro Max',
  'iPhone 16e',
  'iPhone 17',
  'iPhone 17 Pro',
  'iPhone 17 Pro Max',
  'iPhone Air',
  'iPhone SE (2020)',
  'iPhone SE (2022)',
]

export const STORAGES = ['64GB', '128GB', '256GB', '512GB', '1TB']

export const REGIONS = ['iBox', 'Internasional', 'Tidak diketahui']

export const SOURCES = [
  { value: 'facebook_marketplace', label: 'Facebook Marketplace' },
  { value: 'facebook_group', label: 'Grup jual-beli Facebook' },
  { value: 'other', label: 'Lainnya' },
]

export const STATUSES = [
  { value: 'active', label: 'Aktif' },
  { value: 'negotiating', label: 'Negosiasi' },
  { value: 'sold', label: 'Terjual' },
  { value: 'unavailable', label: 'Tidak tersedia' },
  { value: 'archived', label: 'Arsip' },
]

export const FACE_OPTIONS = ['Berfungsi', 'Bermasalah', 'Tidak diketahui']
export const LOCK_OPTIONS = ['Terbuka', 'Terkunci', 'RSIM', 'Tidak diketahui']
export const IMEI_OPTIONS = ['Terdaftar', 'Tidak terdaftar', 'Belum dicek']
export const ICLOUD_OPTIONS = ['Bersih', 'Terkunci', 'Belum dicek']
export const BATTERY_REPLACED_OPTIONS = [
  { value: 'tidak', label: 'Tidak diganti' },
  { value: 'ya', label: 'Diganti' },
  { value: 'unknown', label: 'Tidak diketahui' },
]

export const PRIORITY_CITIES = [
  'Surabaya',
  'Sidoarjo',
  'Gresik',
  'Malang',
  'Mojokerto',
  'Kediri',
  'Jombang',
]

export const EAST_JAVA_CITIES = [
  ...PRIORITY_CITIES,
  'Bangkalan',
  'Banyuwangi',
  'Batu',
  'Blitar',
  'Bojonegoro',
  'Bondowoso',
  'Jember',
  'Lamongan',
  'Lumajang',
  'Madiun',
  'Magetan',
  'Nganjuk',
  'Ngawi',
  'Pacitan',
  'Pamekasan',
  'Pasuruan',
  'Ponorogo',
  'Probolinggo',
  'Sampang',
  'Situbondo',
  'Sumenep',
  'Trenggalek',
  'Tuban',
  'Tulungagung',
]

export const DEFAULT_SETTINGS = {
  fullName: '',
  targetProfit: 500000,
  riskReserve: 300000,
  operationalCost: 150000,
  preferredCities: [...PRIORITY_CITIES],
}

export const CATEGORIES = {
  strong: { label: 'Peluang kuat', tone: 'profit' },
  negotiate: { label: 'Layak dinegosiasi', tone: 'info' },
  normal: { label: 'Harga pasar normal', tone: 'neutral' },
  expensive: { label: 'Terlalu mahal', tone: 'risk' },
  high_risk: { label: 'Risiko tinggi', tone: 'risk' },
  insufficient: { label: 'Data tidak cukup', tone: 'warn' },
}

export function labelOf(options, value) {
  return options.find((item) => item.value === value)?.label || value || '—'
}
