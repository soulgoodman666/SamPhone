import { findComparables } from './market.js'
import { assessOpportunity } from './pricing.js'

export function assessAll(listings, settings) {
  return listings
    .filter((listing) => listing.status === 'active' || listing.status === 'negotiating')
    .map((listing) => {
      const comparables = findComparables(listing, listings)
      return { listing, ...assessOpportunity(listing, comparables, settings) }
    })
}

export function portfolioStats(listings, settings) {
  const prices = listings.map((item) => item.asking_price).filter((value) => Number.isFinite(value))
  const models = new Set(listings.map((item) => item.specs?.model).filter(Boolean))
  const opportunities = assessAll(listings, settings)
    .filter((item) => item.category === 'strong' || item.category === 'negotiate').length
  return {
    total: listings.length,
    models: models.size,
    average: prices.length ? prices.reduce((sum, value) => sum + value, 0) / prices.length : null,
    opportunities,
    active: listings.filter((item) => item.status === 'active').length,
  }
}
