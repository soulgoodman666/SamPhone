import { DEFAULT_SETTINGS } from './constants.js'
import { createDemoState } from './demoData.js'
import { emptySpecs } from './listing.js'

const STORAGE_KEY = 'samphone.intelligence.v1'
const BUCKET = 'listing-images'

export function createLocalRepository() {
  return {
    mode: 'demo',
    async loadAll() {
      return clone(read())
    },
    async saveSettings(settings) {
      const state = read()
      state.settings = { ...DEFAULT_SETTINGS, ...settings }
      write(state)
      return state.settings
    },
    async createListing(payload) {
      const state = read()
      assertUnique(state.listings, payload.normalized_url)
      const listing = makeLocalListing(payload)
      state.listings.unshift(listing)
      write(state)
      return listing
    },
    async updateListing(id, payload) {
      const state = read()
      const index = state.listings.findIndex((item) => item.id === id)
      if (index < 0) throw new Error('Iklan tidak ditemukan.')
      assertUnique(state.listings, payload.normalized_url, id)
      const current = state.listings[index]
      const next = {
        ...current,
        ...payload,
        specs: { ...emptySpecs(), ...payload.specs },
        images: current.images || [],
        price_history: appendHistory(current, payload),
        updated_at: new Date().toISOString(),
        is_sample: current.is_sample,
      }
      state.listings[index] = next
      write(state)
      return next
    },
    async setStatus(id, status) {
      const state = read()
      const listing = state.listings.find((item) => item.id === id)
      if (!listing) throw new Error('Iklan tidak ditemukan.')
      if (listing.status === status) return listing
      listing.price_history = appendHistory(listing, { ...listing, status })
      listing.status = status
      listing.updated_at = new Date().toISOString()
      write(state)
      return listing
    },
    async deleteListing(id) {
      const state = read()
      state.listings = state.listings.filter((item) => item.id !== id)
      write(state)
    },
    async addImage(listingId, file, kind) {
      const state = read()
      const listing = state.listings.find((item) => item.id === listingId)
      if (!listing) throw new Error('Iklan tidak ditemukan.')
      if ((listing.images || []).length >= 8) throw new Error('Maksimal 8 gambar per iklan.')
      const url = await readAsDataUrl(file)
      listing.images = [...(listing.images || []), { id: crypto.randomUUID(), kind, url, path: null }]
      listing.updated_at = new Date().toISOString()
      write(state)
    },
    async deleteImage(listingId, imageId) {
      const state = read()
      const listing = state.listings.find((item) => item.id === listingId)
      if (!listing) throw new Error('Iklan tidak ditemukan.')
      listing.images = (listing.images || []).filter((image) => image.id !== imageId)
      write(state)
    },
    async saveSnapshot(snapshot) {
      const state = read()
      state.snapshots.unshift({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...snapshot })
      state.snapshots = state.snapshots.slice(0, 20)
      write(state)
    },
    async importListings(payloads) {
      const state = read()
      const imported = []
      const errors = []
      payloads.forEach((payload, index) => {
        const duplicate = payload.normalized_url && state.listings.some((item) => item.normalized_url === payload.normalized_url)
        if (duplicate) {
          errors.push({ index, message: `URL sudah tersimpan: ${payload.listing_url}` })
          return
        }
        const listing = makeLocalListing(payload)
        state.listings.unshift(listing)
        imported.push(listing)
      })
      write(state)
      return { imported, errors }
    },
    async resetDemo() {
      localStorage.removeItem(STORAGE_KEY)
      return clone(read())
    },
  }
}

export function createSupabaseRepository(client, userId) {
  return {
    mode: 'live',
    async loadAll() {
      const [listingsResult, profileResult, snapshotResult] = await Promise.all([
        client.from('listings').select('*, listing_specs(*), listing_images(*), price_history(*)').eq('user_id', userId).order('collected_at', { ascending: false }),
        client.from('profiles').select('*').eq('id', userId).maybeSingle(),
        client.from('market_snapshots').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
      ])
      throwIf(listingsResult.error)
      throwIf(profileResult.error)
      throwIf(snapshotResult.error)
      let profile = profileResult.data
      if (!profile) {
        const inserted = await client.from('profiles').insert({ id: userId }).select('*').single()
        throwIf(inserted.error)
        profile = inserted.data
      }
      return {
        listings: await signListings(client, listingsResult.data || []),
        settings: mapSettings(profile),
        snapshots: (snapshotResult.data || []).map(mapSnapshot),
      }
    },
    async saveSettings(settings) {
      const result = await client.from('profiles').update({
        full_name: settings.fullName || null,
        target_profit: settings.targetProfit,
        risk_reserve: settings.riskReserve,
        operational_cost: settings.operationalCost,
        preferred_cities: settings.preferredCities,
      }).eq('id', userId).select('*').single()
      throwIf(result.error)
      return mapSettings(result.data)
    },
    async createListing(payload) {
      const inserted = await client.from('listings').insert({ user_id: userId, ...listingColumns(payload) }).select('id').single()
      throwIf(inserted.error)
      const spec = await client.from('listing_specs').insert({ listing_id: inserted.data.id, ...specColumns(payload.specs) })
      if (spec.error) {
        await client.from('listings').delete().eq('id', inserted.data.id)
        throwIf(spec.error)
      }
      const history = await client.from('price_history').insert({
        listing_id: inserted.data.id,
        asking_price: payload.asking_price,
        status: payload.status,
        note: 'Harga awal saat dikumpulkan',
      })
      throwIf(history.error)
      return loadOne(client, userId, inserted.data.id)
    },
    async updateListing(id, payload) {
      const currentResult = await client.from('listings').select('asking_price, status').eq('id', id).eq('user_id', userId).single()
      throwIf(currentResult.error)
      const updated = await client.from('listings').update(listingColumns(payload)).eq('id', id).eq('user_id', userId)
      throwIf(updated.error)
      const spec = await client.from('listing_specs').upsert({ listing_id: id, ...specColumns(payload.specs) }, { onConflict: 'listing_id' })
      throwIf(spec.error)
      if (!sameMoney(currentResult.data.asking_price, payload.asking_price) || currentResult.data.status !== payload.status) {
        const note = !sameMoney(currentResult.data.asking_price, payload.asking_price) && currentResult.data.status !== payload.status
          ? 'Harga penawaran dan status diperbarui'
          : !sameMoney(currentResult.data.asking_price, payload.asking_price)
            ? 'Harga penawaran diperbarui'
            : 'Status diperbarui'
        const history = await client.from('price_history').insert({
          listing_id: id,
          asking_price: payload.asking_price,
          status: payload.status,
          note,
        })
        throwIf(history.error)
      }
      return loadOne(client, userId, id)
    },
    async setStatus(id, status) {
      const current = await loadOne(client, userId, id)
      if (current.status === status) return current
      const updated = await client.from('listings').update({ status }).eq('id', id).eq('user_id', userId)
      throwIf(updated.error)
      const history = await client.from('price_history').insert({
        listing_id: id,
        asking_price: current.asking_price,
        status,
        note: 'Status diperbarui',
      })
      throwIf(history.error)
      return loadOne(client, userId, id)
    },
    async deleteListing(id) {
      const images = await client.from('listing_images').select('storage_path').eq('listing_id', id)
      throwIf(images.error)
      const deleted = await client.from('listings').delete().eq('id', id).eq('user_id', userId)
      throwIf(deleted.error)
      const paths = (images.data || []).map((image) => image.storage_path).filter(Boolean)
      if (paths.length) {
        const removed = await client.storage.from(BUCKET).remove(paths)
        throwIf(removed.error)
      }
    },
    async addImage(listingId, file, kind) {
      const count = await client.from('listing_images').select('id', { count: 'exact', head: true }).eq('listing_id', listingId)
      throwIf(count.error)
      if ((count.count || 0) >= 8) throw new Error('Maksimal 8 gambar per iklan.')
      const path = `${userId}/${listingId}/${crypto.randomUUID()}.jpg`
      const uploaded = await client.storage.from(BUCKET).upload(path, file, { contentType: file.type || 'image/jpeg' })
      throwIf(uploaded.error)
      const inserted = await client.from('listing_images').insert({ listing_id: listingId, storage_path: path, kind })
      if (inserted.error) {
        await client.storage.from(BUCKET).remove([path])
        throwIf(inserted.error)
      }
    },
    async deleteImage(listingId, imageId) {
      const existing = await client.from('listing_images').select('storage_path').eq('id', imageId).eq('listing_id', listingId).single()
      throwIf(existing.error)
      const deleted = await client.from('listing_images').delete().eq('id', imageId)
      throwIf(deleted.error)
      if (existing.data.storage_path) {
        const removed = await client.storage.from(BUCKET).remove([existing.data.storage_path])
        throwIf(removed.error)
      }
    },
    async saveSnapshot(snapshot) {
      const inserted = await client.from('market_snapshots').insert({
        user_id: userId,
        model: snapshot.model,
        storage: snapshot.storage,
        region: snapshot.region,
        filters: snapshot.filters,
        stats: snapshot.stats,
        sample_size: snapshot.sample_size,
      })
      throwIf(inserted.error)
    },
    async importListings(payloads) {
      const imported = []
      const errors = []
      for (let index = 0; index < payloads.length; index += 1) {
        try {
          imported.push(await this.createListing(payloads[index]))
        } catch (error) {
          errors.push({ index, message: error.message })
        }
      }
      return { imported, errors }
    },
  }
}

function read() {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    const state = createDemoState()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    return state
  }
  try {
    return JSON.parse(raw)
  } catch {
    throw new Error('Data demo di peramban rusak. Atur ulang data demo dari halaman Pengaturan.')
  }
}

function write(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    throw new Error('Penyimpanan peramban penuh. Hapus beberapa gambar atau hubungkan Supabase.')
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function makeLocalListing(payload) {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    is_sample: false,
    images: [],
    created_at: now,
    updated_at: now,
    ...payload,
    price_history: [{
      id: crypto.randomUUID(),
      asking_price: payload.asking_price,
      status: payload.status,
      note: 'Harga awal saat dikumpulkan',
      recorded_at: now,
    }],
  }
}

function appendHistory(current, payload) {
  const history = [...(current.price_history || [])]
  const priceChanged = !sameMoney(current.asking_price, payload.asking_price)
  const statusChanged = current.status !== payload.status
  if (priceChanged || statusChanged) {
    history.push({
      id: crypto.randomUUID(),
      asking_price: payload.asking_price,
      status: payload.status,
      note: priceChanged && statusChanged
        ? 'Harga penawaran dan status diperbarui'
        : priceChanged ? 'Harga penawaran diperbarui' : 'Status diperbarui',
      recorded_at: new Date().toISOString(),
    })
  }
  return history
}

function assertUnique(listings, normalizedUrl, ignoreId = null) {
  if (!normalizedUrl) return
  const duplicate = listings.some((item) => item.id !== ignoreId && item.normalized_url === normalizedUrl)
  if (duplicate) throw new Error('URL iklan ini sudah tersimpan.')
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Gambar tidak dapat dibaca.'))
    reader.readAsDataURL(file)
  })
}

async function loadOne(client, userId, id) {
  const result = await client.from('listings').select('*, listing_specs(*), listing_images(*), price_history(*)').eq('id', id).eq('user_id', userId).single()
  throwIf(result.error)
  const [listing] = await signListings(client, [result.data])
  return listing
}

async function signListings(client, rows) {
  const paths = rows.flatMap((row) => (row.listing_images || []).map((image) => image.storage_path)).filter(Boolean)
  const signed = new Map()
  if (paths.length) {
    const result = await client.storage.from(BUCKET).createSignedUrls(paths, 60 * 60 * 24 * 7)
    throwIf(result.error)
    ;(result.data || []).forEach((item) => {
      if (item.path && item.signedUrl) signed.set(item.path, item.signedUrl)
    })
  }
  return rows.map((row) => mapListing(row, signed))
}

function mapListing(row, signed) {
  const specs = Array.isArray(row.listing_specs) ? row.listing_specs[0] : row.listing_specs
  return {
    id: row.id,
    is_sample: false,
    source_platform: row.source_platform,
    listing_url: row.listing_url,
    normalized_url: row.normalized_url,
    title: row.title,
    description: row.description,
    asking_price: toNumber(row.asking_price),
    listing_date: row.listing_date,
    collected_at: row.collected_at,
    status: row.status,
    province: row.province,
    city: row.city,
    district: row.district,
    seller_notes: row.seller_notes,
    internal_notes: row.internal_notes,
    negotiation_notes: row.negotiation_notes,
    actual_purchase_price: toNumber(row.actual_purchase_price),
    actual_resale_price: toNumber(row.actual_resale_price),
    created_at: row.created_at,
    updated_at: row.updated_at,
    specs: specs ? {
      model: specs.model,
      storage: specs.storage,
      color: specs.color,
      region: specs.region,
      battery_health: toNumber(specs.battery_health),
      battery_replaced: specs.battery_replaced,
      face_id: specs.face_id,
      true_tone: specs.true_tone,
      carrier_lock: specs.carrier_lock,
      imei_status: specs.imei_status,
      icloud_status: specs.icloud_status,
      parts_history: specs.parts_history,
      physical_condition: specs.physical_condition,
      functional_condition: specs.functional_condition,
      repair_history: specs.repair_history,
      missing_fields: specs.missing_fields || [],
      uncertain_fields: specs.uncertain_fields || [],
    } : emptySpecs(),
    images: (row.listing_images || []).map((image) => ({
      id: image.id,
      kind: image.kind,
      path: image.storage_path,
      url: signed.get(image.storage_path) || '',
    })),
    price_history: [...(row.price_history || [])].sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at)).map((item) => ({
      ...item,
      asking_price: toNumber(item.asking_price),
    })),
  }
}

function mapSettings(profile) {
  return {
    fullName: profile.full_name || '',
    targetProfit: Number(profile.target_profit ?? DEFAULT_SETTINGS.targetProfit),
    riskReserve: Number(profile.risk_reserve ?? DEFAULT_SETTINGS.riskReserve),
    operationalCost: Number(profile.operational_cost ?? DEFAULT_SETTINGS.operationalCost),
    preferredCities: profile.preferred_cities?.length ? profile.preferred_cities : [...DEFAULT_SETTINGS.preferredCities],
  }
}

function mapSnapshot(row) {
  return {
    id: row.id,
    created_at: row.created_at,
    model: row.model,
    storage: row.storage,
    region: row.region,
    filters: row.filters,
    stats: row.stats,
    sample_size: row.sample_size,
  }
}

function listingColumns(payload) {
  return {
    source_platform: payload.source_platform,
    listing_url: payload.listing_url,
    normalized_url: payload.normalized_url,
    title: payload.title,
    description: payload.description,
    asking_price: payload.asking_price,
    listing_date: payload.listing_date,
    collected_at: payload.collected_at,
    status: payload.status,
    province: payload.province,
    city: payload.city,
    district: payload.district,
    seller_notes: payload.seller_notes,
    internal_notes: payload.internal_notes,
    negotiation_notes: payload.negotiation_notes,
    actual_purchase_price: payload.actual_purchase_price,
    actual_resale_price: payload.actual_resale_price,
  }
}

function specColumns(specs = {}) {
  return {
    model: specs.model,
    storage: specs.storage,
    color: specs.color,
    region: specs.region,
    battery_health: specs.battery_health == null ? null : Math.round(Number(specs.battery_health)),
    battery_replaced: specs.battery_replaced,
    face_id: specs.face_id,
    true_tone: specs.true_tone,
    carrier_lock: specs.carrier_lock,
    imei_status: specs.imei_status,
    icloud_status: specs.icloud_status,
    parts_history: specs.parts_history,
    physical_condition: specs.physical_condition,
    functional_condition: specs.functional_condition,
    repair_history: specs.repair_history,
    missing_fields: specs.missing_fields || [],
    uncertain_fields: specs.uncertain_fields || [],
  }
}

function toNumber(value) {
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function sameMoney(left, right) {
  return toNumber(left) === toNumber(right)
}

function throwIf(error) {
  if (!error) return
  if (error.code === '23505') throw new Error('URL iklan ini sudah tersimpan.')
  if (error.code === '42P01' || error.code === 'PGRST205') {
    throw new Error('Tabel database belum tersedia. Jalankan migrasi SQL di Supabase SQL Editor.')
  }
  throw new Error(error.message || 'Permintaan Supabase gagal.')
}
