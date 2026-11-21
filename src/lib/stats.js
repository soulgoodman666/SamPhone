/**
 * Linear quantile, equivalent to a PERCENTILE.INC style interpolation.
 * p is a fraction from 0 to 1.
 */
export function quantile(values, p) {
  const sorted = [...values].filter((value) => Number.isFinite(value)).sort((a, b) => a - b)
  if (!sorted.length) return null
  if (sorted.length === 1) return sorted[0]
  const index = (sorted.length - 1) * p
  const low = Math.floor(index)
  const high = Math.ceil(index)
  if (low === high) return sorted[low]
  return sorted[low] * (high - index) + sorted[high] * (index - low)
}

export function summarizePrices(values) {
  const prices = values.filter((value) => Number.isFinite(value))
  if (!prices.length) return null
  const sorted = [...prices].sort((a, b) => a - b)
  const sum = sorted.reduce((total, value) => total + value, 0)
  return {
    count: sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: sum / sorted.length,
    median: quantile(sorted, 0.5),
    q1: quantile(sorted, 0.25),
    q3: quantile(sorted, 0.75),
  }
}

export function iqrFence(values) {
  if (values.length < 4) return null
  const q1 = quantile(values, 0.25)
  const q3 = quantile(values, 0.75)
  const iqr = q3 - q1
  return { lo: q1 - 1.5 * iqr, hi: q3 + 1.5 * iqr }
}

export function sampleQuality(count) {
  if (count < 3) return { level: 'insufficient', label: 'Data tidak cukup' }
  if (count < 5) return { level: 'preliminary', label: 'Perkiraan awal' }
  if (count < 10) return { level: 'moderate', label: 'Keyakinan sedang' }
  return { level: 'stronger', label: 'Dasar pembanding lebih kuat' }
}
