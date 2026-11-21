import { sampleQuality, summarizePrices } from './stats.js'
import { lockClass } from './normalize.js'

export function maxBuyingPrice({ expectedResale, targetProfit, riskReserve, operationalCost }) {
  if (!Number.isFinite(expectedResale)) return null
  return expectedResale - numberOrZero(targetProfit) - numberOrZero(riskReserve) - numberOrZero(operationalCost)
}

export function grossProfit({ expectedResale, purchasePrice }) {
  if (!Number.isFinite(expectedResale) || !Number.isFinite(purchasePrice)) return null
  return expectedResale - purchasePrice
}

export function netProfit({ expectedResale, purchasePrice, repairCost, operationalCost }) {
  if (!Number.isFinite(expectedResale) || !Number.isFinite(purchasePrice)) return null
  return expectedResale - purchasePrice - numberOrZero(repairCost) - numberOrZero(operationalCost)
}

export function profitMargin({ net, expectedResale }) {
  if (!Number.isFinite(net) || !Number.isFinite(expectedResale) || expectedResale === 0) return null
  return (net / expectedResale) * 100
}

export function returnOnInvestment({ net, purchasePrice }) {
  if (!Number.isFinite(net) || !Number.isFinite(purchasePrice) || purchasePrice === 0) return null
  return (net / purchasePrice) * 100
}

export function detectRisks(listing) {
  const specs = listing?.specs || {}
  const risks = []
  const lock = lockClass(specs.carrier_lock)
  const blob = `${specs.parts_history || ''} ${specs.repair_history || ''}`.toLowerCase()

  if (lock === 'restricted' && String(specs.carrier_lock || '').toLowerCase().includes('rsim')) {
    risks.push({ code: 'rsim', serious: true, label: 'RSIM' })
  } else if (lock === 'restricted') {
    risks.push({ code: 'carrier_lock', serious: true, label: 'Terkunci operator' })
  } else if (lock === 'unknown') {
    risks.push({ code: 'carrier_unknown', serious: false, verify: true, label: 'Status kunci operator belum jelas' })
  }

  const imei = String(specs.imei_status || '').toLowerCase()
  if (!imei || imei.includes('belum') || imei.includes('tidak diketahui') || imei.includes('unknown')) {
    risks.push({ code: 'imei_unverified', serious: false, verify: true, label: 'IMEI belum terverifikasi' })
  } else if (imei.includes('tidak terdaftar') || imei.includes('unregistered')) {
    risks.push({ code: 'imei_unregistered', serious: true, label: 'IMEI tidak terdaftar' })
  }

  const icloud = String(specs.icloud_status || '').toLowerCase()
  if (!icloud || icloud.includes('belum') || icloud.includes('tidak diketahui') || icloud.includes('unknown')) {
    risks.push({ code: 'icloud_unknown', serious: false, verify: true, label: 'Status iCloud belum jelas' })
  } else if (/\b(terkunci|locked|on)\b/.test(icloud)) {
    risks.push({ code: 'icloud_locked', serious: true, label: 'iCloud bermasalah' })
  }

  const face = String(specs.face_id || '').toLowerCase()
  if (face.includes('bermasalah') || face.includes('rusak') || face === 'false' || face.includes('tidak berfungsi')) {
    risks.push({ code: 'face_id', serious: true, label: 'Face ID bermasalah' })
  }

  if (/(layar|lcd|oled|touch|kaca retak|ganti lcd|ganti layar)/i.test(blob)) {
    risks.push({ code: 'screen', serious: true, label: 'Indikasi layar diganti atau rusak' })
  }

  if (specs.battery_replaced === true || /baterai diganti|ganti baterai|battery replaced/i.test(blob)) {
    risks.push({ code: 'battery_replaced', serious: false, label: 'Baterai diganti' })
  }
  if (specs.battery_health == null) {
    risks.push({ code: 'battery_unknown', serious: false, label: 'Kesehatan baterai tidak diketahui' })
  } else if (specs.battery_health < 85) {
    risks.push({ code: 'battery_low', serious: false, label: 'Kesehatan baterai di bawah 85%' })
  }

  const repair = String(specs.repair_history || '').trim().toLowerCase()
  if (!repair || repair.includes('tidak diketahui') || repair.includes('unknown')) {
    risks.push({ code: 'repair_unknown', serious: false, label: 'Riwayat servis tidak diketahui' })
  }

  const tone = String(specs.true_tone || '').toLowerCase()
  if (tone.includes('bermasalah') || tone.includes('mati') || tone === 'false') {
    risks.push({ code: 'true_tone', serious: false, label: 'True Tone bermasalah' })
  }

  const uncertain = specs.uncertain_fields || []
  if (uncertain.length) {
    const seriousClaim = uncertain.some((field) => /model|storage|asking_price|imei|icloud|region/i.test(field))
    risks.push({
      code: 'uncertain',
      serious: false,
      verify: seriousClaim,
      label: `Klaim penjual belum terverifikasi: ${uncertain.join(', ')}`,
    })
  }

  return risks
}

export function assessOpportunity(listing, comparables, settings) {
  const prices = (comparables || []).map((item) => item.asking_price).filter((value) => Number.isFinite(value))
  const summary = summarizePrices(prices)
  const quality = sampleQuality(prices.length)
  const risks = detectRisks(listing)
  const serious = risks.some((risk) => risk.serious)
  const needsVerification = risks.some((risk) => risk.verify)
  const expectedResale = summary?.median ?? null
  const maxBuy = maxBuyingPrice({
    expectedResale,
    targetProfit: settings.targetProfit,
    riskReserve: settings.riskReserve,
    operationalCost: settings.operationalCost,
  })
  const potential = netProfit({
    expectedResale,
    purchasePrice: listing.asking_price,
    repairCost: settings.riskReserve,
    operationalCost: settings.operationalCost,
  })

  let category = 'insufficient'
  let reason = 'Model, kapasitas, wilayah, atau harga penawaran belum cukup untuk dibandingkan.'

  if (!listing?.specs?.model || !listing?.specs?.storage || !Number.isFinite(listing?.asking_price)) {
    reason = 'Model, kapasitas, atau harga penawaran belum lengkap.'
  } else if (!listing.specs.region || /tidak diketahui/i.test(listing.specs.region)) {
    reason = 'Wilayah unit tidak diketahui. iBox dan internasional tidak digabung.'
  } else if (quality.level === 'insufficient') {
    reason = `Hanya ${prices.length} iklan pembanding dengan model, kapasitas, wilayah, dan kelompok kunci yang sama.`
  } else if (serious) {
    category = 'high_risk'
    reason = 'Ada masalah yang sudah terkonfirmasi (misalnya kunci operator, IMEI tidak terdaftar, iCloud terkunci, atau Face ID rusak). Harga rendah saja tidak cukup untuk merekomendasikan pembelian.'
  } else if (maxBuy != null && listing.asking_price <= maxBuy) {
    if (needsVerification) {
      category = 'negotiate'
      reason = 'Harga sudah di bawah harga beli maksimum, tetapi IMEI, iCloud, kunci operator, atau klaim penjual belum terverifikasi. Cek dulu sebelum membeli.'
    } else {
      category = 'strong'
      reason = 'Harga penawaran sudah pada atau di bawah harga beli maksimum menurut target laba, cadangan risiko, dan biaya operasional Anda.'
    }
  } else if (expectedResale != null && listing.asking_price <= expectedResale) {
    category = 'negotiate'
    reason = 'Harga masih tidak lebih tinggi dari median penawaran, tetapi belum masuk harga beli maksimum. Masih perlu negosiasi.'
  } else if (expectedResale != null && listing.asking_price <= expectedResale * 1.05) {
    category = 'normal'
    reason = 'Harga penawaran berada di dekat median kelompok pembanding.'
  } else {
    category = 'expensive'
    reason = 'Harga penawaran berada di atas median kelompok pembanding.'
  }

  return {
    summary,
    quality,
    risks,
    expectedResale,
    maxBuy,
    potentialProfit: potential,
    category,
    reason,
    comparableCount: prices.length,
    needsVerification,
    estimateBasis: 'median_asking_price',
  }
}

function numberOrZero(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0
}
