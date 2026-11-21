import { actualResales, applyOutlierFilter, filterMarketListings } from './market.js'
import { lockClass } from './normalize.js'
import { formatRupiah } from './format.js'
import { quantile, sampleQuality, summarizePrices } from './stats.js'

const DAY = 86400000

export const BATTERY_LABELS = {
  high: '90% ke atas',
  mid: '85–89%',
  low: 'Di bawah 85%',
  unknown: 'Tidak diketahui',
}

export function batteryBucket(value) {
  if (value == null || value === '' || !Number.isFinite(Number(value))) return 'unknown'
  const number = Number(value)
  if (number >= 90) return 'high'
  if (number >= 85) return 'mid'
  return 'low'
}

/** Hanya iklan yang dikumpulkan dalam `days` hari terakhir. days kosong/0 = semua. */
export function withinWindow(listings, days, now = Date.now()) {
  if (!days) return listings
  const cutoff = now - Number(days) * DAY
  return listings.filter((item) => {
    const time = new Date(item.collected_at).getTime()
    return Number.isFinite(time) && time >= cutoff
  })
}

export function roundPrice(value, step = 50000) {
  return Number.isFinite(value) ? Math.round(value / step) * step : null
}

export function roundUpPrice(value, step = 50000) {
  return Number.isFinite(value) ? Math.ceil(value / step) * step : null
}

/** Hari dari iklan tayang (atau terkumpul) sampai ditandai terjual. Ini perkiraan, bukan waktu transaksi pasti. */
export function daysToSold(listing) {
  const sold = [...(listing.price_history || [])]
    .sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at))
    .find((entry) => entry.status === 'sold')
  if (!sold) return null
  const start = new Date(listing.listing_date ? `${listing.listing_date}T12:00:00` : listing.collected_at).getTime()
  const end = new Date(sold.recorded_at).getTime()
  const days = (end - start) / DAY
  return Number.isFinite(days) && days >= 0 ? days : null
}

function monthKey(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return { key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`, date }
}

export function monthlyTrend(listings) {
  const buckets = new Map()
  listings.forEach((item) => {
    const month = monthKey(item.collected_at)
    if (!month || !Number.isFinite(item.asking_price)) return
    if (!buckets.has(month.key)) {
      buckets.set(month.key, {
        key: month.key,
        label: month.date.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }),
        prices: [],
      })
    }
    buckets.get(month.key).prices.push(item.asking_price)
  })
  return [...buckets.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(({ prices, ...rest }) => ({ ...rest, count: prices.length, median: quantile(prices, 0.5) }))
}

/**
 * Rencana harga jual dari iklan pembanding.
 * Harga pasang = posisi di pasar (Q1 / median / Q3 dari harga iklan).
 * Perkiraan harga laku = harga pasang x faktor tawar (diukur dari transaksi Anda bila ada, jika tidak dari asumsi).
 */
export function buildSellPlan(listings, input, now = Date.now()) {
  const {
    model, storage, region, lock = '', windowDays = 45, removeOutliers = true, battery = null,
    purchasePrice = null, minProfit = 0, operationalCost = 0, bargainPct = 5,
  } = input

  const base = filterMarketListings(listings, { model, storage, region, lock, statuses: ['active', 'negotiating'] })
  const windowed = withinWindow(base, windowDays, now)
  const cleaned = removeOutliers ? applyOutlierFilter(windowed) : { listings: windowed, removedCount: 0 }
  const group = cleaned.listings

  const bucket = batteryBucket(battery)
  const similar = bucket === 'unknown' ? [] : group.filter((item) => batteryBucket(item.specs?.battery_health) === bucket)
  const usedBatteryMatch = similar.length >= 3
  const basis = usedBatteryMatch ? similar : group

  const summary = summarizePrices(basis.map((item) => item.asking_price))
  const quality = sampleQuality(basis.length)
  const meta = {
    baseCount: base.length,
    windowedCount: windowed.length,
    removedOutliers: cleaned.removedCount,
    usedBatteryMatch,
    batteryBucket: bucket,
    quality,
    count: basis.length,
  }
  if (!summary || quality.level === 'insufficient') return { ok: false, ...meta }

  const sold = actualResales(listings, { model, storage, region })
    .filter((item) => Number.isFinite(item.asking_price) && item.asking_price > 0)
  const ratios = sold.map((item) => item.actual_resale_price / item.asking_price).filter((ratio) => ratio > 0.5 && ratio <= 1.2)
  const measuredRatio = ratios.length >= 3 ? Math.min(quantile(ratios, 0.5), 1) : null
  const saleFactor = measuredRatio ?? 1 - Number(bargainPct || 0) / 100

  const cost = Number.isFinite(operationalCost) ? operationalCost : 0
  const tiers = [
    { key: 'fast', label: 'Cepat laku', listPrice: roundPrice(summary.q1) },
    { key: 'market', label: 'Harga pasar', listPrice: roundPrice(summary.median) },
    { key: 'ambitious', label: 'Ambisius', listPrice: roundPrice(summary.q3) },
  ].map((tier) => {
    const expectedSale = tier.listPrice * saleFactor
    const profit = purchasePrice == null ? null : expectedSale - purchasePrice - cost
    return { ...tier, expectedSale, profit, meetsMin: profit == null ? null : profit >= minProfit }
  })

  let recommended = null
  let advice
  const [fast, market, ambitious] = tiers
  if (purchasePrice == null) {
    recommended = 'market'
    advice = 'Isi harga beli untuk melihat laba dan rekomendasi yang sesuai target Anda.'
  } else if (market.meetsMin) {
    recommended = 'market'
    advice = fast.meetsMin
      ? 'Pasang di harga pasar. Jika 1–2 minggu belum ada tawaran serius, turunkan bertahap ke harga cepat laku; di level itu Anda masih memenuhi laba minimum.'
      : 'Pasang di harga pasar. Harga cepat laku sudah di bawah laba minimum Anda, jadi jangan turun melewati batas bawah di bawah.'
  } else if (ambitious.meetsMin) {
    recommended = 'ambitious'
    advice = 'Laba minimum baru tercapai di harga ambisius (di atas median). Unit bisa lebih lama laku. Pasang di sana hanya jika kondisinya jelas lebih baik dari pembanding.'
  } else {
    advice = 'Pada harga pasar saat ini laba minimum tidak tercapai, bahkan di harga ambisius. Pertimbangkan menurunkan target laba atau tidak membeli unit serupa di harga itu.'
  }

  const floorSale = purchasePrice == null ? null : purchasePrice + cost + minProfit
  const floorList = floorSale == null ? null : roundUpPrice(floorSale / saleFactor)
  const floorAbove = floorList == null ? null : basis.filter((item) => item.asking_price >= floorList).length

  const batteryTable = ['high', 'mid', 'low', 'unknown'].map((key) => {
    const rows = group.filter((item) => batteryBucket(item.specs?.battery_health) === key)
    return { key, label: BATTERY_LABELS[key], count: rows.length, median: rows.length ? quantile(rows.map((i) => i.asking_price), 0.5) : null }
  })

  const history = filterMarketListings(listings, { model, storage, region, lock, statuses: ['active', 'negotiating', 'sold', 'unavailable'] })
  const trend = monthlyTrend(history)
  const reliable = trend.filter((point) => point.count >= 3)
  const trendChangePct = reliable.length >= 2
    ? ((reliable[reliable.length - 1].median - reliable[reliable.length - 2].median) / reliable[reliable.length - 2].median) * 100
    : null

  const soldDays = history.filter((item) => item.status === 'sold').map(daysToSold).filter((days) => days != null)
  const timeToSell = soldDays.length >= 3 ? { count: soldDays.length, median: quantile(soldDays, 0.5) } : null

  return {
    ok: true, ...meta, summary, tiers, recommended, advice, saleFactor, measuredRatio, measuredCount: ratios.length,
    floorSale, floorList, floorAbove, batteryTable, trend, trendChangePct, timeToSell,
  }
}

/** Teks iklan dari data unit. Hanya klaim yang diisi/dicentang pengguna yang ditulis. */
export function buildAdText(unit) {
  const {
    model = '', storage = '', color = '', region = '', lock = '', battery = null, batteryReplaced = false,
    imeiRegistered = false, icloudClean = false, accessories = '', condition = '', flaws = '', city = '', price = null,
  } = unit
  const headline = [model, storage, color].filter(Boolean).join(' ') + (region ? ` · ${region}` : '')
  const lines = [headline.trim() || 'iPhone bekas']
  if (Number.isFinite(price)) lines.push(`Harga: ${formatRupiah(price)}`)
  lines.push('')
  if (Number.isFinite(battery)) lines.push(`• Battery health ${battery}%${batteryReplaced ? ' (baterai sudah diganti)' : ''}`)
  if (lockClass(lock) === 'open') lines.push('• Unlock / bebas operator')
  if (imeiRegistered) lines.push('• IMEI terdaftar')
  if (icloudClean) lines.push('• iCloud bersih')
  if (condition.trim()) lines.push(`• Kondisi: ${condition.trim()}`)
  if (accessories.trim()) lines.push(`• Kelengkapan: ${accessories.trim()}`)
  if (flaws.trim()) lines.push(`• Minus: ${flaws.trim()}`)
  if (city.trim()) lines.push('', `Lokasi: ${city.trim()}`)
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}
