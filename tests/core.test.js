import test from 'node:test'
import assert from 'node:assert/strict'
import { findComparables, filterMarketListings } from '../src/lib/market.js'
import { maxBuyingPrice, netProfit, detectRisks, assessOpportunity } from '../src/lib/pricing.js'
import { quantile, sampleQuality, summarizePrices } from '../src/lib/stats.js'
import { parseExtractionInput } from '../src/lib/schema.js'

const listing = (id, model, storage, region, lock, price, status = 'active') => ({
  id,
  asking_price: price,
  status,
  specs: { model, storage, region, carrier_lock: lock },
})

test('price summary calculates median, quartiles and sample size deterministically', () => {
  const summary = summarizePrices([900, 100, 500, 300, 700])
  assert.equal(summary.count, 5)
  assert.equal(summary.min, 100)
  assert.equal(summary.max, 900)
  assert.equal(summary.mean, 500)
  assert.equal(summary.median, 500)
  assert.equal(summary.q1, 300)
  assert.equal(summary.q3, 700)
  assert.equal(quantile([1, 3], 0.25), 1.5)
})

test('sample quality uses the requested count thresholds', () => {
  assert.equal(sampleQuality(2).level, 'insufficient')
  assert.equal(sampleQuality(3).level, 'preliminary')
  assert.equal(sampleQuality(5).level, 'moderate')
  assert.equal(sampleQuality(10).level, 'stronger')
})

test('buying ceiling and net profit keep costs separate', () => {
  assert.equal(maxBuyingPrice({ expectedResale: 1000, targetProfit: 200, riskReserve: 100, operationalCost: 50 }), 650)
  assert.equal(netProfit({ expectedResale: 1000, purchasePrice: 600, repairCost: 100, operationalCost: 50 }), 250)
})

test('market comparisons do not mix model, storage, region, or lock class', () => {
  const subject = listing('subject', 'iPhone 14 Pro', '128GB', 'iBox', 'Terbuka', 500)
  const matching = listing('match', 'iPhone 14 Pro', '128GB', 'iBox', 'Terbuka', 700)
  const rows = [
    matching,
    listing('max', 'iPhone 14 Pro Max', '128GB', 'iBox', 'Terbuka', 900),
    listing('storage', 'iPhone 14 Pro', '256GB', 'iBox', 'Terbuka', 900),
    listing('region', 'iPhone 14 Pro', '128GB', 'Internasional', 'Terbuka', 900),
    listing('locked', 'iPhone 14 Pro', '128GB', 'iBox', 'RSIM', 300),
    listing('archived', 'iPhone 14 Pro', '128GB', 'iBox', 'Terbuka', 400, 'archived'),
  ]
  assert.deepEqual(findComparables(subject, rows).map((item) => item.id), ['match'])
})

test('market filter excludes incomplete price and inactive records by default', () => {
  const rows = [
    listing('good', 'iPhone 13', '128GB', 'iBox', 'Terbuka', 500),
    listing('no-price', 'iPhone 13', '128GB', 'iBox', 'Terbuka', null),
    listing('sold', 'iPhone 13', '128GB', 'iBox', 'Terbuka', 300, 'sold'),
  ]
  assert.deepEqual(filterMarketListings(rows, { model: 'iPhone 13', storage: '128GB', region: 'iBox' }).map((item) => item.id), ['good'])
})

test('manual extraction parser accepts valid structured output and reports invalid values', () => {
  const valid = parseExtractionInput('{"model":"iPhone 13","storage":"128GB","asking_price":6500000,"battery_health":null}')
  assert.equal(valid[0].ok, true)
  const invalid = parseExtractionInput('{"model":"iPhone 13","asking_price":-10}')
  assert.equal(invalid[0].ok, false)
  assert.match(invalid[0].errors.join(' '), /asking_price/)
})

test('risk checks flag unverified carrier, IMEI and iCloud status', () => {
  const risks = detectRisks({ specs: { carrier_lock: 'RSIM', imei_status: 'Belum dicek', icloud_status: 'Belum dicek' } })
  assert.ok(risks.some((risk) => risk.code === 'rsim' && risk.serious))
  assert.ok(risks.some((risk) => risk.code === 'imei_unverified'))
  assert.ok(risks.some((risk) => risk.code === 'icloud_unknown'))
})

const fullSpecs = { model: 'iPhone 13', storage: '128GB', region: 'iBox', carrier_lock: 'Terbuka', imei_status: 'Terdaftar', icloud_status: 'Bersih', repair_history: 'Tidak pernah servis', battery_health: 90 }
const settings = { targetProfit: 500000, riskReserve: 300000, operationalCost: 150000 }
const comps = [6000000, 6200000, 6300000, 6500000, 6600000].map((price, i) => ({ id: `c${i}`, asking_price: price, status: 'active', specs: fullSpecs }))

test('verified clean unit below the buying ceiling is a strong opportunity', () => {
  const result = assessOpportunity({ id: 's', asking_price: 5000000, specs: fullSpecs }, comps, settings)
  assert.equal(result.category, 'strong')
})

test('unverified iCloud is a warning, not an automatic high-risk label', () => {
  const specs = { ...fullSpecs, icloud_status: 'Belum dicek' }
  const result = assessOpportunity({ id: 's', asking_price: 5000000, specs }, comps, settings)
  assert.equal(result.category, 'negotiate')
  assert.equal(result.needsVerification, true)
})

test('confirmed iCloud lock is high risk and "on" inside other words is not a match', () => {
  const locked = assessOpportunity({ id: 's', asking_price: 5000000, specs: { ...fullSpecs, icloud_status: 'Terkunci' } }, comps, settings)
  assert.equal(locked.category, 'high_risk')
  const noise = detectRisks({ specs: { ...fullSpecs, icloud_status: 'Bersih, konfirmasi lewat foto' } })
  assert.ok(!noise.some((risk) => risk.code === 'icloud_locked'))
})

import { buildAdText, buildSellPlan, daysToSold, batteryBucket } from '../src/lib/selling.js'

const NOW = new Date('2026-11-21T12:00:00').getTime()
const daysAgo = (days) => new Date(NOW - days * 86400000).toISOString()
const sellRow = (id, price, extra = {}) => ({
  id, asking_price: price, status: 'active', collected_at: daysAgo(5),
  specs: { model: 'iPhone 13', storage: '128GB', region: 'iBox', carrier_lock: 'Terbuka', battery_health: 90 }, ...extra,
})
const sellRows = [6000000, 6200000, 6400000, 6600000, 6800000].map((price, i) => sellRow(`s${i}`, price))
const sellInput = { model: 'iPhone 13', storage: '128GB', region: 'iBox', lock: 'open', windowDays: 45, bargainPct: 5, minProfit: 500000, operationalCost: 150000 }

test('sell plan gives three price positions and expected sale after bargaining', () => {
  const plan = buildSellPlan(sellRows, { ...sellInput, purchasePrice: 5000000 }, NOW)
  assert.equal(plan.ok, true)
  assert.deepEqual(plan.tiers.map((tier) => tier.listPrice), [6200000, 6400000, 6600000])
  assert.equal(plan.tiers[1].expectedSale, 6400000 * 0.95)
  assert.equal(plan.recommended, 'market')
  assert.equal(plan.floorSale, 5650000)
})

test('sell plan says so when even the ambitious price misses the minimum profit', () => {
  const plan = buildSellPlan(sellRows, { ...sellInput, purchasePrice: 6500000 }, NOW)
  assert.equal(plan.recommended, null)
  assert.match(plan.advice, /tidak tercapai/)
})

test('sell plan ignores listings older than the window and refuses tiny samples', () => {
  const old = sellRows.map((row) => ({ ...row, collected_at: daysAgo(90) }))
  assert.equal(buildSellPlan(old, sellInput, NOW).ok, false)
  assert.equal(buildSellPlan(old, { ...sellInput, windowDays: 0 }, NOW).ok, true)
})

test('measured resale ratio replaces the assumed bargain percentage', () => {
  const sold = [0.9, 0.92, 0.94].map((ratio, i) => sellRow(`d${i}`, 6000000, { status: 'sold', actual_resale_price: 6000000 * ratio }))
  const plan = buildSellPlan([...sellRows, ...sold], { ...sellInput, purchasePrice: 5000000 }, NOW)
  assert.equal(plan.measuredCount, 3)
  assert.ok(Math.abs(plan.saleFactor - 0.92) < 1e-9)
})

test('battery bucket match is used only with at least three similar listings', () => {
  assert.equal(batteryBucket(87), 'mid')
  assert.equal(batteryBucket(null), 'unknown')
  const plan = buildSellPlan(sellRows, { ...sellInput, battery: 90 }, NOW)
  assert.equal(plan.usedBatteryMatch, true)
  const none = buildSellPlan(sellRows, { ...sellInput, battery: 80 }, NOW)
  assert.equal(none.usedBatteryMatch, false)
})

test('days to sold uses the sold entry in price history', () => {
  const days = daysToSold({ listing_date: '2026-11-01', price_history: [{ status: 'active', recorded_at: '2026-11-01T05:00:00Z' }, { status: 'sold', recorded_at: '2026-11-11T12:00:00' }] })
  assert.ok(Math.abs(days - 10) < 1)
  assert.equal(daysToSold({ price_history: [] }), null)
})

test('ad text only states what was provided', () => {
  const text = buildAdText({ model: 'iPhone 13', storage: '128GB', region: 'iBox', lock: 'Terbuka', battery: 91, price: 6500000, imeiRegistered: true })
  assert.match(text, /Battery health 91%/)
  assert.match(text, /IMEI terdaftar/)
  assert.ok(!/iCloud bersih/.test(text))
  assert.ok(!/Minus/.test(text))
})
