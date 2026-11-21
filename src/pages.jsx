import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Activity, AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronDown, Clipboard, Download,
  ExternalLink, FileDown, FileJson, FileSpreadsheet, ImagePlus, LoaderCircle, Pencil, Plus, Search,
  Smartphone, Trash2, Upload, X,
} from 'lucide-react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { useAuth } from './context/AuthContext'
import { useAppData } from './context/AppDataContext'
import {
  BATTERY_REPLACED_OPTIONS, CATEGORIES, EAST_JAVA_CITIES, FACE_OPTIONS, ICLOUD_OPTIONS,
  IMEI_OPTIONS, LOCK_OPTIONS, MODELS, REGIONS, SOURCES, STATUSES, STORAGES,
} from './lib/constants'
import { listingsToCsv, listingsToExport, downloadText, exportFilename, templateCsv } from './lib/csv'
import { formatDateId, formatDateTimeId, formatPercent, formatRupiah, todayInput } from './lib/format'
import { importFromText } from './lib/importData'
import { emptyForm, extractionToForm, formToListing, listingToForm } from './lib/listing'
import { applyOutlierFilter, countByCity, countByMonth, dateRange, filterMarketListings, findComparables, medianByGroup } from './lib/market'
import { assessAll, portfolioStats } from './lib/opportunities'
import { buildExtractionPrompt } from './lib/prompt'
import { grossProfit, maxBuyingPrice, netProfit, profitMargin, returnOnInvestment } from './lib/pricing'
import { extractionSchema, formatZodError, listingFormSchema, parseExtractionInput } from './lib/schema'
import { sampleQuality, summarizePrices } from './lib/stats'
import { compressImage } from './lib/images'
import { Badge, Button, Card, Definition, EmptyState, Field, PageHeader, StatCard, inputClass, useDocumentTitle } from './components/ui'

const CHART_BLUE = '#2563eb'
const statusLabel = (status) => STATUSES.find((item) => item.value === status)?.label || status || '—'
const sourceLabel = (source) => SOURCES.find((item) => item.value === source)?.label || 'Lainnya'
const spec = (listing) => listing?.specs || {}
const listingName = (listing) => listing?.title || [spec(listing).model, spec(listing).storage].filter(Boolean).join(' ') || 'Iklan tanpa judul'

function SectionTitle({ title, children }) {
  return <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-semibold text-slate-900">{title}</h2>{children}</div>
}

function SelectField({ label, value, onChange, options, placeholder = 'Pilih…', className = '' }) {
  return <label className={`block ${className}`}><span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span><select className={inputClass} value={value} onChange={(event) => onChange(event.target.value)}><option value="">{placeholder}</option>{options.map((option) => {
    const item = typeof option === 'string' ? { value: option, label: option } : option
    return <option key={item.value} value={item.value}>{item.label}</option>
  })}</select></label>
}

function ListingTable({ listings, onDelete, compact = false }) {
  if (!listings.length) return <EmptyState title="Belum ada iklan" body="Tambahkan iklan secara manual, atau gunakan alur Asisten ChatGPT untuk menyiapkan detailnya." action={<Link to="/iklan/baru"><Button><Plus size={16} />Tambah iklan</Button></Link>} />
  return <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full min-w-[780px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Perangkat</th><th className="px-4 py-3">Harga penawaran</th><th className="px-4 py-3">Detail</th><th className="px-4 py-3">Lokasi</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Dikumpulkan</th><th className="px-4 py-3">Aksi</th></tr></thead><tbody className="divide-y divide-slate-100">{listings.map((item) => {
    const image = item.images?.[0]?.url
    return <tr key={item.id} className="hover:bg-slate-50/70"><td className="px-4 py-3"><div className="flex items-center gap-3">{image ? <img src={image} alt="" className="h-11 w-11 rounded-xl object-cover" /> : <div className="grid h-11 w-11 place-items-center rounded-xl bg-slate-100 text-slate-400"><Smartphone size={18} /></div>}<div><Link className="font-medium text-slate-900 hover:text-blue-700" to={`/iklan/${item.id}`}>{listingName(item)}</Link><p className="mt-0.5 text-xs text-slate-500">{sourceLabel(item.source_platform)}</p></div></div></td><td className="px-4 py-3 font-semibold text-slate-900">{formatRupiah(item.asking_price)}</td><td className="px-4 py-3 text-slate-600">{spec(item).region || 'Wilayah belum diketahui'}{spec(item).battery_health != null ? ` · Baterai ${spec(item).battery_health}%` : ''}</td><td className="px-4 py-3 text-slate-600">{[item.city, item.province].filter(Boolean).join(', ') || '—'}</td><td className="px-4 py-3"><Badge tone={item.status === 'active' ? 'profit' : item.status === 'sold' ? 'neutral' : item.status === 'unavailable' ? 'risk' : 'info'}>{statusLabel(item.status)}</Badge></td><td className="px-4 py-3 text-slate-500">{formatDateId(item.collected_at)}</td><td className="px-4 py-3"><div className="flex items-center gap-1"><Link aria-label="Lihat detail" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" to={`/iklan/${item.id}`}><ExternalLink size={16} /></Link><Link aria-label="Edit iklan" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" to={`/iklan/${item.id}/edit`}><Pencil size={16} /></Link>{!compact && <button aria-label="Hapus iklan" className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-700" onClick={() => onDelete?.(item)}><Trash2 size={16} /></button>}</div></td></tr>
  })}</tbody></table></div>
}

export function DashboardPage() {
  useDocumentTitle('Dasbor')
  const { listings, loading, mode } = useAppData()
  const portfolio = portfolioStats(listings, {})
  const trends = countByMonth(listings)
  const models = medianByGroup(listings).slice(0, 6).map((item) => ({ ...item, price: Math.round(item.median) }))
  const cities = countByCity(listings).slice(0, 6)
  const recent = [...listings].sort((a, b) => new Date(b.collected_at) - new Date(a.collected_at)).slice(0, 5)
  return <>
    <PageHeader title="Dasbor" description="Ringkasan inventaris dan data harga penawaran yang Anda kumpulkan." actions={<Link to="/iklan/baru"><Button><Plus size={16} />Tambah iklan</Button></Link>} />
    {mode === 'demo' && <div className="mb-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle size={18} className="mt-0.5 shrink-0" /><p><strong>Mode demo.</strong> Data contoh di bawah hanya untuk mencoba aplikasi, bukan data pasar aktual. Data Anda disimpan lokal di peramban ini sampai Supabase dikonfigurasi.</p></div>}
    {mode === 'none' && <Card className="mb-5 text-sm text-slate-600">Masuk atau pilih mode demo untuk mulai menggunakan aplikasi.</Card>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <StatCard label="Total iklan" value={loading ? '…' : portfolio.total} hint="Data yang tersimpan" />
      <StatCard label="Model unik" value={portfolio.models} hint="Berdasarkan spesifikasi yang terisi" tone="info" />
      <StatCard label="Rata-rata penawaran" value={formatRupiah(portfolio.average)} hint="Bukan harga transaksi" />
      <StatCard label="Peluang potensial" value={portfolio.opportunities} hint="Tinjau risiko sebelum membeli" tone="profit" />
      <StatCard label="Iklan aktif" value={portfolio.active} hint="Status aktif saat ini" tone="info" />
    </div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_1fr]">
      <Card><SectionTitle title="Tren koleksi iklan" /><p className="mb-4 text-xs text-slate-500">Jumlah iklan yang dikumpulkan per bulan. Tidak menunjukkan harga transaksi.</p><div className="h-64">{trends.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={trends}><defs><linearGradient id="fillCount" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={CHART_BLUE} stopOpacity={0.22} /><stop offset="95%" stopColor={CHART_BLUE} stopOpacity={0.01} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} /><Tooltip /><Area dataKey="count" name="Jumlah iklan" type="monotone" stroke={CHART_BLUE} fill="url(#fillCount)" strokeWidth={2} /></AreaChart></ResponsiveContainer> : <div className="grid h-full place-items-center text-sm text-slate-400">Belum ada data untuk ditampilkan.</div>}</div></Card>
      <Card><SectionTitle title="Iklan terbaru" /><div className="space-y-4">{recent.length ? recent.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0"><div className="min-w-0"><Link to={`/iklan/${item.id}`} className="block truncate text-sm font-medium text-slate-900 hover:text-blue-700">{listingName(item)}</Link><p className="mt-1 text-xs text-slate-500">{item.city || 'Lokasi belum diisi'} · {formatDateId(item.collected_at)}</p></div><span className="shrink-0 text-sm font-semibold">{formatRupiah(item.asking_price)}</span></div>) : <p className="py-10 text-center text-sm text-slate-500">Belum ada iklan.</p>}</div><Link className="mt-3 inline-block text-sm font-medium text-blue-700" to="/iklan">Lihat semua iklan →</Link></Card>
    </div>
    <div className="mt-5 grid gap-5 lg:grid-cols-2">
      <Card><SectionTitle title="Harga penawaran per model" /><p className="mb-3 text-xs text-slate-500">Median dari data tersimpan menurut model dan kapasitas.</p><div className="h-64">{models.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={models} layout="vertical" margin={{ left: 18 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" tickFormatter={(value) => `${Math.round(value / 1e6)} jt`} /><YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} /><Tooltip formatter={(value) => formatRupiah(value)} /><Bar dataKey="price" name="Median penawaran" fill={CHART_BLUE} radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer> : <div className="grid h-full place-items-center text-sm text-slate-400">Perlu model, kapasitas, dan harga untuk membandingkan.</div>}</div></Card>
      <Card><SectionTitle title="Iklan menurut kota" /><div className="space-y-4">{cities.length ? cities.map((entry, index) => <div key={entry.city}><div className="mb-1 flex justify-between text-sm"><span>{entry.city}</span><span className="text-slate-500">{entry.count} iklan</span></div><div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-blue-600" style={{ width: `${Math.max(8, (entry.count / cities[0].count) * 100)}%`, opacity: 1 - index * 0.08 }} /></div></div>) : <p className="py-10 text-center text-sm text-slate-500">Belum ada data lokasi.</p>}</div></Card>
    </div>
  </>
}

export function ListingsPage() {
  useDocumentTitle('Iklan')
  const { listings, deleteListing, mode } = useAppData()
  const [query, setQuery] = useState('')
  const [model, setModel] = useState('')
  const [storage, setStorage] = useState('')
  const [city, setCity] = useState('')
  const [status, setStatus] = useState('')
  const [minimum, setMinimum] = useState('')
  const [maximum, setMaximum] = useState('')
  const [sort, setSort] = useState('newest')
  const filtered = useMemo(() => listings.filter((item) => {
    const text = `${listingName(item)} ${item.description || ''} ${item.city || ''} ${spec(item).model || ''}`.toLowerCase()
    return (!query || text.includes(query.toLowerCase())) && (!model || spec(item).model === model) && (!storage || spec(item).storage === storage) && (!city || item.city === city) && (!status || item.status === status) && (minimum === '' || (item.asking_price != null && item.asking_price >= Number(minimum))) && (maximum === '' || (item.asking_price != null && item.asking_price <= Number(maximum)))
  }).sort((a, b) => sort === 'oldest' ? new Date(a.collected_at) - new Date(b.collected_at) : sort === 'cheapest' ? (a.asking_price ?? Infinity) - (b.asking_price ?? Infinity) : sort === 'expensive' ? (b.asking_price ?? -Infinity) - (a.asking_price ?? -Infinity) : new Date(b.collected_at) - new Date(a.collected_at)), [listings, query, model, storage, city, status, minimum, maximum, sort])
  async function remove(item) {
    if (window.confirm(`Hapus “${listingName(item)}”? Tindakan ini tidak dapat dibatalkan.`)) await deleteListing(item.id)
  }
  return <><PageHeader title="Kelola iklan" description="Cari, filter, urutkan, dan tinjau iklan yang sudah Anda catat." actions={<><Button variant="secondary" onClick={() => downloadText(exportFilename('csv'), listingsToCsv(listings), 'text/csv;charset=utf-8')}><FileSpreadsheet size={16} />Ekspor CSV</Button><Button variant="secondary" onClick={() => downloadText(exportFilename('json'), JSON.stringify(listingsToExport(listings, mode), null, 2), 'application/json')}><FileJson size={16} />Ekspor JSON</Button><Link to="/iklan/baru"><Button><Plus size={16} />Tambah iklan</Button></Link></>} />
    <Card className="mb-5"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="relative sm:col-span-2"><span className="mb-1.5 block text-sm font-medium text-slate-700">Cari kata kunci</span><Search size={16} className="absolute left-3 top-10 text-slate-400" /><input className={`${inputClass} pl-9`} placeholder="Model, judul, deskripsi, kota…" value={query} onChange={(event) => setQuery(event.target.value)} /></label><SelectField label="Model" value={model} onChange={setModel} options={MODELS} /><SelectField label="Kapasitas" value={storage} onChange={setStorage} options={STORAGES} /><SelectField label="Kota" value={city} onChange={setCity} options={[...new Set(listings.map((item) => item.city).filter(Boolean))].sort()} /><SelectField label="Status" value={status} onChange={setStatus} options={STATUSES} /><label><span className="mb-1.5 block text-sm font-medium text-slate-700">Harga minimum</span><input className={inputClass} type="number" min="0" value={minimum} onChange={(event) => setMinimum(event.target.value)} placeholder="Rp" /></label><label><span className="mb-1.5 block text-sm font-medium text-slate-700">Harga maksimum</span><input className={inputClass} type="number" min="0" value={maximum} onChange={(event) => setMaximum(event.target.value)} placeholder="Rp" /></label><SelectField label="Urutkan" value={sort} onChange={setSort} options={[{ value: 'newest', label: 'Terbaru' }, { value: 'oldest', label: 'Terlama' }, { value: 'cheapest', label: 'Termurah' }, { value: 'expensive', label: 'Termahal' }]} /></div><p className="mt-4 text-xs text-slate-500">Menampilkan {filtered.length} dari {listings.length} iklan{mode === 'demo' ? ' · data lokal/demo' : ''}.</p></Card>
    <ListingTable listings={filtered} onDelete={remove} />
  </>
}

const formGroups = [
  { title: 'Informasi iklan', fields: [
    ['source_platform', 'Sumber', 'select', SOURCES], ['listing_url', 'URL iklan', 'url'], ['title', 'Judul iklan', 'text'], ['description', 'Deskripsi', 'textarea'], ['asking_price', 'Harga penawaran (Rp)', 'number'], ['listing_date', 'Tanggal iklan', 'date'], ['collected_date', 'Tanggal dikumpulkan', 'date'], ['status', 'Status iklan', 'select', STATUSES],
  ] },
  { title: 'Spesifikasi perangkat', fields: [
    ['model', 'Model iPhone', 'select', MODELS], ['storage', 'Kapasitas penyimpanan', 'select', STORAGES], ['color', 'Warna', 'text'], ['region', 'Wilayah unit', 'select', REGIONS], ['battery_health', 'Kesehatan baterai (%)', 'number'], ['battery_replaced', 'Baterai pernah diganti?', 'select', [{ value: 'ya', label: 'Ya' }, { value: 'tidak', label: 'Tidak' }, { value: 'unknown', label: 'Tidak diketahui' }]], ['face_id', 'Face ID', 'select', FACE_OPTIONS], ['true_tone', 'True Tone', 'select', FACE_OPTIONS], ['carrier_lock', 'Kunci operator', 'select', LOCK_OPTIONS], ['imei_status', 'Status IMEI', 'select', IMEI_OPTIONS], ['icloud_status', 'Status iCloud', 'select', ICLOUD_OPTIONS], ['parts_history', 'Riwayat komponen', 'textarea'], ['physical_condition', 'Kondisi fisik', 'textarea'], ['functional_condition', 'Kondisi fungsi', 'textarea'], ['repair_history', 'Riwayat perbaikan', 'textarea'],
  ] },
  { title: 'Lokasi', fields: [ ['province', 'Provinsi', 'text'], ['city', 'Kota/kabupaten', 'select', EAST_JAVA_CITIES], ['district', 'Kecamatan', 'text'] ] },
  { title: 'Catatan dan transaksi', fields: [ ['seller_notes', 'Catatan penjual', 'textarea'], ['internal_notes', 'Catatan internal', 'textarea'], ['negotiation_notes', 'Catatan negosiasi', 'textarea'], ['actual_purchase_price', 'Harga beli aktual (Rp)', 'number'], ['actual_resale_price', 'Harga jual aktual (Rp)', 'number'] ] },
]

export function ListingFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { listings, createListing, updateListing, addImage } = useAppData()
  const existing = id ? listings.find((item) => item.id === id) : null
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [selectedImages, setSelectedImages] = useState([])
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(listingFormSchema), defaultValues: existing ? listingToForm(existing) : emptyForm() })
  useDocumentTitle(existing ? 'Edit iklan' : 'Tambah iklan')
  async function submit(values) {
    setBusy(true); setMessage('')
    try {
      const payload = formToListing(values)
      const saved = existing ? await updateListing(existing.id, payload) : await createListing(payload)
      for (const file of selectedImages) await addImage(saved.id, await compressImage(file), file.kind)
      navigate(`/iklan/${saved.id}`)
    } catch (error) { setMessage(error.message || 'Iklan tidak dapat disimpan.') }
    finally { setBusy(false) }
  }
  if (id && !existing) return <EmptyState title="Iklan tidak ditemukan" body="Data mungkin telah dihapus atau belum dimuat." action={<Link to="/iklan"><Button variant="secondary">Kembali ke iklan</Button></Link>} />
  function renderField(field) {
    const [name, label, type, choices] = field
    const error = errors[name]?.message
    const props = { ...register(name), className: inputClass }
    return <Field key={name} label={label} error={error}>
      {type === 'textarea' ? <textarea {...props} rows={3} /> : type === 'select' ? <select {...props}><option value="">Tidak diketahui / pilih…</option>{choices.map((option) => { const item = typeof option === 'string' ? { value: option, label: option } : option; return <option key={item.value} value={item.value}>{item.label}</option> })}</select> : <input {...props} type={type} min={type === 'number' ? '0' : undefined} step={name.includes('price') ? '1000' : 'any'} placeholder={type === 'url' ? 'https://www.facebook.com/…' : undefined} />}
    </Field>
  }
  return <><PageHeader title={existing ? 'Edit iklan' : 'Tambah iklan'} description="Isi informasi yang diketahui. Spesifikasi yang belum terverifikasi boleh dikosongkan; jangan menebak data yang tidak tersedia." actions={<Link to={existing ? `/iklan/${id}` : '/iklan'}><Button variant="secondary">Batal</Button></Link>} />
    <form onSubmit={handleSubmit(submit)} className="space-y-5">{formGroups.map((group) => <Card key={group.title}><SectionTitle title={group.title} /><div className="grid gap-4 md:grid-cols-2">{group.fields.map(renderField)}</div></Card>)}
      <Card><SectionTitle title="Foto produk dan tangkapan layar" /><p className="mb-3 text-sm text-slate-500">Maksimal 8 gambar per iklan. Foto disimpan di penyimpanan pribadi saat Supabase terhubung; mode demo menyimpan di peramban.</p><input type="file" accept="image/*" multiple className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2" onChange={(event) => setSelectedImages(Array.from(event.target.files || []).slice(0, 8))} /><div className="mt-2 flex flex-wrap gap-2">{selectedImages.map((file, index) => <span className="rounded-full bg-slate-100 px-3 py-1 text-xs" key={`${file.name}-${index}`}>{file.name}</span>)}</div></Card>
      {message && <div role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{message}</div>}
      <div className="flex flex-wrap justify-end gap-2"><Link to={existing ? `/iklan/${id}` : '/iklan'}><Button variant="secondary">Batal</Button></Link><Button type="submit" disabled={busy}>{busy && <LoaderCircle className="animate-spin" size={16} />}{existing ? 'Simpan perubahan' : 'Simpan iklan'}</Button></div>
    </form>
  </>
}

export function ListingDetailPage() {
  const { id } = useParams()
  const { listings, setStatus, deleteListing, addImage, deleteImage } = useAppData()
  const [busy, setBusy] = useState(false)
  const listing = listings.find((item) => item.id === id)
  useDocumentTitle(listing ? listingName(listing) : 'Detail iklan')
  if (!listing) return <EmptyState title="Iklan tidak ditemukan" body="Data mungkin telah dihapus atau belum dimuat." action={<Link to="/iklan"><Button variant="secondary">Kembali ke iklan</Button></Link>} />
  async function upload(event) {
    const files = Array.from(event.target.files || []).slice(0, Math.max(0, 8 - (listing.images || []).length))
    setBusy(true)
    try { for (const file of files) await addImage(listing.id, await compressImage(file), 'product') } finally { setBusy(false); event.target.value = '' }
  }
  async function remove() { if (window.confirm(`Hapus “${listingName(listing)}”? Tindakan ini tidak dapat dibatalkan.`)) { await deleteListing(id); window.location.assign('/iklan') } }
  const definitions = [ ['Judul', listing.title], ['Model', spec(listing).model], ['Penyimpanan', spec(listing).storage], ['Warna', spec(listing).color], ['Wilayah unit', spec(listing).region], ['Kesehatan baterai', spec(listing).battery_health == null ? null : `${spec(listing).battery_health}%`], ['Baterai diganti', spec(listing).battery_replaced == null ? null : spec(listing).battery_replaced ? 'Ya' : 'Tidak'], ['Face ID', spec(listing).face_id], ['True Tone', spec(listing).true_tone], ['Kunci operator', spec(listing).carrier_lock], ['IMEI', spec(listing).imei_status], ['iCloud', spec(listing).icloud_status], ['Kondisi fisik', spec(listing).physical_condition], ['Kondisi fungsi', spec(listing).functional_condition], ['Riwayat komponen', spec(listing).parts_history], ['Riwayat perbaikan', spec(listing).repair_history], ['Sumber', sourceLabel(listing.source_platform)], ['Tanggal iklan', formatDateId(listing.listing_date)], ['Dikumpulkan', formatDateId(listing.collected_at)], ['Provinsi', listing.province], ['Kota/kabupaten', listing.city], ['Kecamatan', listing.district], ['Harga beli aktual', formatRupiah(listing.actual_purchase_price)], ['Harga jual aktual', formatRupiah(listing.actual_resale_price)], ['Catatan penjual', listing.seller_notes], ['Catatan internal', listing.internal_notes], ['Catatan negosiasi', listing.negotiation_notes] ].map(([label, value]) => ({ label, value }))
  return <><PageHeader title={listingName(listing)} description="Detail iklan, data spesifikasi, gambar, dan riwayat harga penawaran." actions={<><Link to={`/iklan/${id}/edit`}><Button variant="secondary"><Pencil size={16} />Edit</Button></Link>{listing.listing_url && <a href={listing.listing_url} target="_blank" rel="noreferrer"><Button variant="secondary"><ExternalLink size={16} />Buka sumber</Button></a>}<Button variant="danger" onClick={remove}><Trash2 size={16} />Hapus</Button></>} />
    <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]"><div className="space-y-5"><Card><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-wide text-slate-500">Harga penawaran</p><p className="mt-1 text-3xl font-semibold">{formatRupiah(listing.asking_price)}</p></div><SelectField label="Status iklan" value={listing.status} onChange={(value) => setStatus(id, value)} options={STATUSES} /></div><p className="text-xs text-slate-500">Harga ini adalah harga yang diminta penjual, bukan harga transaksi terkonfirmasi.</p></Card><Card><SectionTitle title="Spesifikasi dan catatan" /><Definition items={definitions} /></Card><Card><SectionTitle title="Deskripsi iklan" /><p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{listing.description || 'Tidak ada deskripsi.'}</p></Card><Card><SectionTitle title="Gambar" /><label className="mb-4 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"><ImagePlus size={16} />Tambah gambar<input type="file" accept="image/*" multiple className="hidden" onChange={upload} disabled={busy} /></label>{busy && <span className="ml-2 text-xs text-slate-500">Mengunggah…</span>}<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{(listing.images || []).map((image) => <div className="relative" key={image.id}><img className="aspect-square w-full rounded-xl object-cover" src={image.url} alt="Gambar iklan" /><button aria-label="Hapus gambar" className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-rose-700" onClick={() => deleteImage(id, image.id)}><X size={15} /></button></div>)}</div>{!listing.images?.length && <p className="text-sm text-slate-500">Belum ada gambar.</p>}</Card></div><div className="space-y-5"><Card><SectionTitle title="Status iklan" /><Badge tone={listing.status === 'active' ? 'profit' : 'neutral'}>{statusLabel(listing.status)}</Badge><p className="mt-3 text-sm text-slate-600">Iklan yang hilang atau tidak dapat diakses tidak otomatis dianggap terjual.</p></Card><Card><SectionTitle title="Riwayat perubahan" /><HistoryEntries history={listing.price_history} /></Card></div></div>
  </>
}

function HistoryEntries({ history = [] }) {
  if (!history.length) return <p className="text-sm text-slate-500">Belum ada perubahan yang tercatat.</p>
  return <ol className="space-y-4">{[...history].sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at)).map((entry) => <li className="border-l-2 border-blue-200 pl-3" key={entry.id}><p className="text-sm font-medium">{formatRupiah(entry.asking_price)} · {statusLabel(entry.status)}</p><p className="mt-1 text-xs text-slate-500">{formatDateTimeId(entry.recorded_at)}{entry.note ? ` · ${entry.note}` : ''}</p></li>)}</ol>
}

export function AssistantPage() {
  useDocumentTitle('Asisten ChatGPT')
  const navigate = useNavigate()
  const { createListing } = useAppData()
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [files, setFiles] = useState([])
  const [jsonText, setJsonText] = useState('')
  const [records, setRecords] = useState([])
  const [active, setActive] = useState(0)
  const [prompt, setPrompt] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef(null)
  function makePrompt() {
    setPrompt(buildExtractionPrompt({ url, description, imageCount: files.length }))
    setNotice('Prompt dibuat. Salin ke ChatGPT secara manual dan lampirkan gambar di percakapan ChatGPT jika diperlukan.')
  }
  async function copyPrompt() {
    try { await navigator.clipboard.writeText(prompt); setNotice('Prompt tersalin. Tempelkan secara manual di ChatGPT.') } catch { setNotice('Clipboard tidak tersedia. Pilih dan salin prompt secara manual.') }
  }
  function validateJson() {
    setNotice('')
    try {
      const results = parseExtractionInput(jsonText)
      setRecords(results.map((result) => result.ok ? { ...result, form: extractionToForm(result.data, { listing_url: url, description }) } : result))
      setActive(0)
      if (!results.some((result) => !result.ok)) setNotice(`${results.length} objek JSON valid. Periksa dan edit sebelum menyimpan.`)
    } catch (error) { setRecords([]); setNotice(error.message) }
  }
  async function saveReview() {
    const record = records[active]
    if (!record?.ok) return
    const checked = listingFormSchema.safeParse(record.form)
    if (!checked.success) { setNotice(formatZodError(checked.error).join(' · ')); return }
    setBusy(true)
    try { const saved = await createListing(formToListing(checked.data)); navigate(`/iklan/${saved.id}`) }
    catch (error) { setNotice(error.message || 'Data tidak dapat disimpan.') }
    finally { setBusy(false) }
  }
  const current = records[active]
  return <><PageHeader title="Asisten ChatGPT" description="Siapkan permintaan ekstraksi, lalu gunakan ChatGPT sendiri dan tinjau hasilnya sebelum menyimpan." />
    <div className="mb-5 flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950"><Clipboard size={18} className="mt-0.5 shrink-0" /><p><strong>Alur manual, tanpa API berbayar.</strong> Aplikasi ini tidak terhubung langsung ke ChatGPT dan tidak mengirimkan data secara otomatis. Salin prompt, lampirkan sendiri foto di ChatGPT, lalu tempelkan JSON hasilnya di sini.</p></div>
    <div className="grid gap-5 xl:grid-cols-2"><Card><SectionTitle title="1. Siapkan bahan" /><div className="space-y-4"><Field label="URL iklan Facebook" hint="URL hanya disimpan sebagai referensi; aplikasi tidak mengambil isi halaman Facebook."><input value={url} onChange={(event) => setUrl(event.target.value)} className={inputClass} placeholder="https://www.facebook.com/marketplace/…" /></Field><Field label="Deskripsi iklan"><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={7} className={inputClass} placeholder="Tempel teks iklan dan klaim penjual…" /></Field><div><span className="mb-1.5 block text-sm font-medium text-slate-700">Gambar untuk ChatGPT</span><input ref={fileRef} type="file" multiple accept="image/*" className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2" onChange={(event) => setFiles(Array.from(event.target.files || []))} /><p className="mt-1 text-xs text-slate-500">Berkas tidak diunggah ke ChatGPT oleh aplikasi. Lampirkan sendiri di percakapan ChatGPT. {files.length ? `${files.length} gambar dipilih.` : ''}</p></div><Button onClick={makePrompt}>Buat prompt ekstraksi</Button></div></Card>
      <Card><SectionTitle title="2. Salin prompt" /><textarea readOnly value={prompt} rows={19} className={`${inputClass} font-mono text-xs leading-5`} placeholder="Prompt akan ditampilkan di sini…" /><Button className="mt-3" variant="secondary" disabled={!prompt} onClick={copyPrompt}><Clipboard size={16} />Salin prompt</Button></Card></div>
    <Card className="mt-5"><SectionTitle title="3. Tempel JSON hasil ChatGPT" /><p className="mb-3 text-sm text-slate-500">Objek tunggal, array, atau format <span className="font-mono">{'{ "listings": [...] }'}</span> diterima. Nilai yang tidak diketahui tetap boleh kosong/null.</p><textarea value={jsonText} onChange={(event) => setJsonText(event.target.value)} rows={9} className={`${inputClass} font-mono text-xs leading-5`} placeholder={`{
  "model": "iPhone 13",
  "storage": "128GB",
  "asking_price": 6500000,
  "battery_health": null,
  "missing_fields": ["battery_health"]
}`} /><div className="mt-3 flex flex-wrap gap-2"><Button onClick={validateJson}>Validasi dan tinjau</Button><Button variant="secondary" onClick={() => { setJsonText(''); setRecords([]); setNotice('') }}>Kosongkan</Button></div>{notice && <p role="status" className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{notice}</p>}</Card>
    {current && <Card className="mt-5"><SectionTitle title="4. Tinjau sebelum menyimpan"><div className="flex items-center gap-2">{records.length > 1 && <select className={inputClass} value={active} onChange={(event) => setActive(Number(event.target.value))}>{records.map((item, index) => <option value={index} key={index}>Data {index + 1}</option>)}</select>}</div></SectionTitle>{!current.ok ? <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{current.errors.join(' · ')}</div> : <><p className="mb-4 text-sm text-slate-600">Data telah lolos validasi dasar. Koreksi bila perlu; hasil tetap merupakan ekstraksi dari klaim yang disediakan, bukan verifikasi perangkat.</p><div className="grid gap-3 md:grid-cols-3">{['model','storage','color','asking_price','battery_health','region','city','district','carrier_lock','imei_status','battery_status','physical_condition','functional_condition','repair_history','parts_history','seller_notes'].map((key) => <label key={key} className="block"><span className="mb-1 block text-xs font-medium text-slate-600">{key.replaceAll('_',' ')}</span><input className={inputClass} value={key === 'battery_status' ? current.form.battery_replaced : current.form[key] ?? ''} type={['asking_price','battery_health'].includes(key) ? 'number' : 'text'} onChange={(event) => setRecords((all) => all.map((item, index) => index === active ? { ...item, form: { ...item.form, [key === 'battery_status' ? 'battery_replaced' : key]: event.target.value } } : item))} /></label>)}</div><div className="mt-4 flex flex-wrap gap-2"><Button disabled={busy} onClick={saveReview}>{busy ? <LoaderCircle className="animate-spin" size={16} /> : <Check size={16} />}Konfirmasi dan simpan</Button><Link to="/iklan/baru"><Button variant="secondary">Edit semua field di formulir lengkap</Button></Link></div></>}</Card>}
  </>
}

const DEFAULT_MARKET_FILTERS = { model: '', storage: '', region: '', city: '', batteryMin: '', batteryMax: '' }

export function MarketPage() {
  useDocumentTitle('Analisis Pasar')
  const { listings, saveSnapshot } = useAppData()
  const [filters, setFilters] = useState(DEFAULT_MARKET_FILTERS)
  const [outliers, setOutliers] = useState(false)
  const query = useMemo(() => filterMarketListings(listings, { ...filters, statuses: ['active', 'negotiating'] }), [listings, filters])
  const filtered = outliers ? applyOutlierFilter(query) : { listings: query, removedCount: 0 }
  const prices = filtered.listings.map((item) => item.asking_price)
  const summary = summarizePrices(prices)
  const quality = sampleQuality(prices.length)
  const range = dateRange(filtered.listings)
  const qualityTone = quality.level === 'insufficient' ? 'risk' : quality.level === 'preliminary' ? 'warn' : quality.level === 'moderate' ? 'info' : 'profit'
  function set(key, value) { setFilters((state) => ({ ...state, [key]: value })) }
  async function snapshot() {
    if (!summary) return
    await saveSnapshot({ model: filters.model, storage: filters.storage, region: filters.region, filters, stats: summary, sample_size: summary.count })
  }
  return <><PageHeader title="Analisis pasar" description="Bandingkan harga penawaran sejenis. Hasil bukan harga transaksi atau interval kepercayaan statistik." actions={<Button variant="secondary" disabled={!summary} onClick={snapshot}>Simpan snapshot</Button>} />
    <Card><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><SelectField label="Model iPhone" value={filters.model} onChange={(value) => set('model', value)} options={MODELS} /><SelectField label="Penyimpanan" value={filters.storage} onChange={(value) => set('storage', value)} options={STORAGES} /><SelectField label="Wilayah unit (wajib)" value={filters.region} onChange={(value) => set('region', value)} options={REGIONS.filter((region) => region !== 'Tidak diketahui')} /><SelectField label="Kota (opsional)" value={filters.city} onChange={(value) => set('city', value)} options={[...new Set(listings.map((item) => item.city).filter(Boolean))].sort()} /><label><span className="mb-1.5 block text-sm font-medium text-slate-700">Baterai minimum</span><input className={inputClass} type="number" min="0" max="100" value={filters.batteryMin} onChange={(event) => set('batteryMin', event.target.value)} placeholder="%" /></label><label><span className="mb-1.5 block text-sm font-medium text-slate-700">Baterai maksimum</span><input className={inputClass} type="number" min="0" max="100" value={filters.batteryMax} onChange={(event) => set('batteryMax', event.target.value)} placeholder="%" /></label></div><label className="mt-4 inline-flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={outliers} onChange={(event) => setOutliers(event.target.checked)} />Kecualikan pencilan dengan metode IQR (opsional)</label></Card>
    {!filters.model || !filters.storage || !filters.region ? <div className="mt-5"><EmptyState title="Pilih produk pembanding" body="Pilih model, kapasitas, dan wilayah unit yang sama. iBox dan unit internasional tidak digabungkan." /></div> : <><div className="mt-5 flex flex-wrap items-center gap-2"><Badge tone={qualityTone}>{quality.label}</Badge><Badge>{prices.length} pembanding</Badge>{filtered.removedCount > 0 && <Badge tone="warn">{filtered.removedCount} pencilan dikecualikan</Badge>}</div>{!summary ? <div className="mt-4"><EmptyState title="Data pembanding belum cukup" body="Kumpulkan minimal 3 iklan aktif atau dalam negosiasi dengan spesifikasi yang sama." /></div> : <><div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><StatCard label="Terendah" value={formatRupiah(summary.min)} /><StatCard label="Tertinggi" value={formatRupiah(summary.max)} /><StatCard label="Rata-rata" value={formatRupiah(summary.mean)} /><StatCard label="Median · referensi utama" value={formatRupiah(summary.median)} tone="info" /><StatCard label="Kuartil 1 – 3" value={`${formatRupiah(summary.q1)} – ${formatRupiah(summary.q3)}`} /></div><Card className="mt-5"><SectionTitle title="Sebaran harga penawaran" /><div className="h-72"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={filtered.listings.map((item, index) => ({ label: `Iklan ${index + 1}`, price: item.asking_price, city: item.city || '—' }))}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis tickFormatter={(value) => `${Math.round(value / 1e6)} jt`} /><Tooltip formatter={(value) => formatRupiah(value)} /><Bar dataKey="price" name="Harga penawaran" fill="#93c5fd" radius={[5,5,0,0]} /><Line dataKey={() => summary.median} name="Median" stroke="#16a34a" dot={false} strokeDasharray="5 5" /></ComposedChart></ResponsiveContainer></div><p className="mt-2 text-xs leading-5 text-slate-500">Sampel {prices.length} iklan. Acuan data dikumpulkan {range ? `${formatDateId(range.from)} – ${formatDateId(range.to)}` : '—'}. Estimasi hanya dari harga penawaran aktif/negosiasi; transaksi aktual tidak dicampur.</p></Card><Card className="mt-5"><SectionTitle title="Iklan yang dibandingkan" /><ListingTable listings={filtered.listings} compact /></Card></>}</>}
  </>
}

export function OpportunitiesPage() {
  useDocumentTitle('Peluang Beli')
  const { listings, settings } = useAppData()
  const opportunities = assessAll(listings, settings)
  const [category, setCategory] = useState('')
  const visible = category ? opportunities.filter((item) => item.category === category) : opportunities
  return <><PageHeader title="Peluang beli" description="Penyaringan berdasarkan median harga penawaran sebanding, biaya, target laba, dan risiko yang diketahui." /><div className="mb-5 flex flex-wrap gap-2">{['', ...Object.keys(CATEGORIES)].map((key) => <button key={key} onClick={() => setCategory(key)} className={`rounded-full border px-3 py-1.5 text-sm ${category === key ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600'}`}>{key ? CATEGORIES[key].label : 'Semua kategori'}</button>)}</div>{visible.length ? <div className="space-y-4">{visible.map(({ listing, ...result }) => <Card key={listing.id}><div className="flex flex-col justify-between gap-4 md:flex-row"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Link to={`/iklan/${listing.id}`} className="text-base font-semibold text-slate-900 hover:text-blue-700">{listingName(listing)}</Link><Badge tone={CATEGORIES[result.category].tone}>{CATEGORIES[result.category].label}</Badge><Badge tone={result.quality.level === 'insufficient' ? 'warn' : 'neutral'}>{result.comparableCount} pembanding</Badge></div><p className="mt-2 text-sm leading-6 text-slate-600">{result.reason}</p><div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm"><span>Penawaran: <strong>{formatRupiah(listing.asking_price)}</strong></span><span>Median penawaran: <strong>{formatRupiah(result.expectedResale)}</strong></span><span>Maksimum beli: <strong>{formatRupiah(result.maxBuy)}</strong></span></div>{result.risks.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{result.risks.map((risk) => <Badge key={risk.code} tone={risk.serious ? 'risk' : 'warn'}>{risk.label}</Badge>)}</div>}</div><div className="shrink-0 rounded-xl bg-slate-50 px-4 py-3 md:min-w-40"><p className="text-xs text-slate-500">Potensi laba bersih*</p><p className={`mt-1 text-xl font-semibold ${result.potentialProfit < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{formatRupiah(result.potentialProfit)}</p><p className="mt-2 text-xs text-slate-500">*Menggunakan cadangan risiko dan biaya operasional</p></div></div></Card>)}</div> : <EmptyState title="Tidak ada iklan pada kategori ini" body="Coba pilih kategori lain atau kumpulkan lebih banyak data pembanding." />}</>
}

export function ProfitCalculatorPage() {
  useDocumentTitle('Kalkulator Laba')
  const { settings } = useAppData()
  const [values, setValues] = useState({ estimated: '', asking: '', purchase: '', target: settings.targetProfit, reserve: settings.riskReserve, costs: settings.operationalCost })
  const numeric = (key) => values[key] === '' ? null : Number(values[key])
  const expectedResale = numeric('estimated')
  const purchasePrice = numeric('purchase')
  const maxBuy = maxBuyingPrice({ expectedResale, targetProfit: numeric('target') ?? 0, riskReserve: numeric('reserve') ?? 0, operationalCost: numeric('costs') ?? 0 })
  const gross = grossProfit({ expectedResale, purchasePrice })
  const net = netProfit({ expectedResale, purchasePrice, repairCost: numeric('reserve'), operationalCost: numeric('costs') })
  const margin = profitMargin({ net, expectedResale })
  const roi = returnOnInvestment({ net, purchasePrice })
  const inputs = [ ['estimated', 'Perkiraan harga jual', 'Median atau estimasi yang Anda tetapkan'], ['asking', 'Harga penawaran penjual', 'Tidak termasuk otomatis dalam laba'], ['purchase', 'Harga beli hasil negosiasi', 'Digunakan untuk laba aktual yang diperkirakan'], ['target', 'Target laba minimum', 'Dipakai menghitung batas harga beli'], ['reserve', 'Cadangan perbaikan/risiko', 'Dikurangkan dari laba bersih'], ['costs', 'Biaya operasional', 'Transportasi, aksesoris, dan biaya lain'] ]
  return <><PageHeader title="Kalkulator laba" description="Ubah input untuk melihat rumus secara langsung. Harga penawaran penjual dan harga beli aktual diperlakukan terpisah." /><div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]"><Card><SectionTitle title="Input perhitungan" />{inputs.map(([key,label,hint]) => <label key={key} className="mb-4 block"><span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span><input type="number" min="0" step="1000" className={inputClass} value={values[key]} onChange={(event) => setValues((state) => ({ ...state, [key]: event.target.value }))} placeholder="Rp" /><span className="mt-1 block text-xs text-slate-500">{hint}</span></label>)}</Card><div className="space-y-5"><Card><SectionTitle title="Hasil" /><div className="space-y-4"><ResultRow label="Maksimum harga beli" value={formatRupiah(maxBuy)} /><ResultRow label="Laba kotor perkiraan" value={formatRupiah(gross)} /><ResultRow label="Laba bersih perkiraan" value={formatRupiah(net)} accent={net != null && net < 0 ? 'risk' : 'profit'} /><ResultRow label="Margin laba" value={formatPercent(margin)} /><ResultRow label="ROI atas harga beli" value={formatPercent(roi)} /></div></Card><Card><SectionTitle title="Rincian rumus" /><div className="space-y-3 text-sm leading-6 text-slate-700"><p><strong>Maksimum beli</strong> = harga jual estimasi − target laba − cadangan risiko − biaya operasional.</p><p><strong>Laba kotor</strong> = harga jual estimasi − harga beli hasil negosiasi.</p><p><strong>Laba bersih</strong> = harga jual estimasi − harga beli − cadangan perbaikan/risiko − biaya operasional.</p><p><strong>Margin</strong> = laba bersih ÷ harga jual estimasi. <strong>ROI</strong> = laba bersih ÷ harga beli.</p><p className="text-xs text-slate-500">Harga penawaran penjual ditampilkan sebagai konteks dan tidak menggantikan harga beli negosiasi.</p></div></Card></div></div></>
}

function ResultRow({ label, value, accent }) { return <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0"><span className="text-sm text-slate-600">{label}</span><strong className={`text-right text-lg ${accent === 'risk' ? 'text-rose-700' : accent === 'profit' ? 'text-emerald-700' : 'text-slate-900'}`}>{value}</strong></div> }

export function PriceHistoryPage() {
  useDocumentTitle('Riwayat Harga')
  const { listings } = useAppData()
  const rows = listings.flatMap((listing) => (listing.price_history || []).map((entry) => ({ ...entry, listing, recorded_at: entry.recorded_at || entry.created_at }))).sort((a,b) => new Date(b.recorded_at) - new Date(a.recorded_at))
  const [status, setStatus] = useState('')
  const filtered = status ? rows.filter((entry) => entry.status === status) : rows
  return <><PageHeader title="Riwayat harga" description="Riwayat mencatat harga penawaran dan status yang diketahui. Iklan yang tidak dapat diakses tidak otomatis dianggap terjual." /><Card className="mb-5"><div className="max-w-xs"><SelectField label="Filter status" value={status} onChange={setStatus} options={STATUSES} /></div><p className="mt-3 text-xs text-slate-500">{filtered.length} catatan · harga permintaan, bukan bukti transaksi.</p></Card>{filtered.length ? <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Tanggal perubahan</th><th className="px-4 py-3">Iklan</th><th className="px-4 py-3">Harga penawaran</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Catatan</th></tr></thead><tbody className="divide-y divide-slate-100">{filtered.map((entry) => <tr key={`${entry.listing.id}-${entry.id}`}><td className="px-4 py-3">{formatDateTimeId(entry.recorded_at)}</td><td className="px-4 py-3"><Link className="font-medium hover:text-blue-700" to={`/iklan/${entry.listing.id}`}>{listingName(entry.listing)}</Link></td><td className="px-4 py-3 font-semibold">{formatRupiah(entry.asking_price)}</td><td className="px-4 py-3"><Badge>{statusLabel(entry.status)}</Badge></td><td className="px-4 py-3 text-slate-500">{entry.note || '—'}</td></tr>)}</tbody></table></div> : <EmptyState title="Belum ada riwayat harga" body="Perubahan harga dan status akan dicatat di sini ketika data iklan diperbarui." />}</>
}

export function SettingsPage() {
  useDocumentTitle('Pengaturan')
  const { settings, saveSettings, listings, importListings, resetDemo, mode } = useAppData()
  const { user, configured, connection } = useAuth()
  const [form, setForm] = useState({ ...settings, preferredCities: [...settings.preferredCities] })
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef(null)
  const [importReport, setImportReport] = useState(null)
  useEffect(() => {
    setForm({ ...settings, preferredCities: [...settings.preferredCities] })
  }, [settings])
  function update(key, value) { setForm((state) => ({ ...state, [key]: value })) }
  async function save(event) { event.preventDefault(); setBusy(true); setNotice(''); try { await saveSettings({ ...form, targetProfit: Number(form.targetProfit) || 0, riskReserve: Number(form.riskReserve) || 0, operationalCost: Number(form.operationalCost) || 0 }); setNotice('Pengaturan berhasil disimpan.') } catch (error) { setNotice(error.message) } finally { setBusy(false) } }
  async function importFile(event) {
    const file = event.target.files?.[0]; if (!file) return
    const text = await file.text(); const result = importFromText(text, file.name)
    if (result.fatal) { setImportReport({ imported: 0, errors: [{ index: 0, message: result.fatal }] }); event.target.value = ''; return }
    const valid = result.rows.filter((row) => row.ok).map((row) => row.listing)
    const invalid = result.rows.filter((row) => !row.ok).map((row) => ({ index: row.index, message: row.errors.join('; ') }))
    let imported = 0; let errors = [...invalid]
    if (valid.length) {
      try {
        const outcome = await importListings(valid)
        imported = outcome.imported.length
        errors = [...errors, ...outcome.errors]
      } catch (error) {
        errors.push({ index: 0, message: error.message || 'Impor gagal.' })
      }
    }
    setImportReport({ imported, errors: errors.length ? errors : (valid.length ? [] : [{ index: 0, message: 'Tidak ada baris valid untuk diimpor.' }]), validCount: valid.length })
    event.target.value = ''
  }
  const toggleCity = (city) => update('preferredCities', form.preferredCities.includes(city) ? form.preferredCities.filter((item) => item !== city) : [...form.preferredCities, city])
  return <><PageHeader title="Pengaturan" description="Preferensi analisis, data akun, serta impor dan ekspor." /><div className="grid gap-5 xl:grid-cols-2"><Card><SectionTitle title="Preferensi bisnis" /><form onSubmit={save} className="space-y-4"><Field label="Nama pemilik"><input className={inputClass} value={form.fullName} onChange={(event) => update('fullName', event.target.value)} /></Field><Field label="Target laba (Rp)"><input className={inputClass} type="number" min="0" value={form.targetProfit} onChange={(event) => update('targetProfit', event.target.value)} /></Field><Field label="Cadangan risiko/perbaikan (Rp)"><input className={inputClass} type="number" min="0" value={form.riskReserve} onChange={(event) => update('riskReserve', event.target.value)} /></Field><Field label="Biaya operasional default (Rp)"><input className={inputClass} type="number" min="0" value={form.operationalCost} onChange={(event) => update('operationalCost', event.target.value)} /></Field><div><p className="mb-2 text-sm font-medium text-slate-700">Kota pilihan</p><div className="flex flex-wrap gap-2">{EAST_JAVA_CITIES.map((city) => <label key={city} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"><input type="checkbox" checked={form.preferredCities.includes(city)} onChange={() => toggleCity(city)} />{city}</label>)}</div></div><Button disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan pengaturan'}</Button>{notice && <p role="status" className="text-sm text-slate-600">{notice}</p>}</form></Card><div className="space-y-5"><Card><SectionTitle title="Akun dan koneksi" /><Definition items={[{ label: 'Mode data', value: mode === 'live' ? 'Supabase (sesi aktif)' : mode === 'demo' ? 'Demo lokal' : 'Belum aktif' }, { label: 'Email akun', value: user?.email || 'Tidak masuk' }, { label: 'Status koneksi', value: connection }, { label: 'Gambar listing', value: mode === 'live' ? 'Supabase Storage privat' : 'Penyimpanan peramban demo' }]} /><p className="mt-4 text-xs leading-5 text-slate-500">Supabase memakai anon key di aplikasi dan kebijakan RLS. Jangan menaruh service role key di frontend.</p></Card><Card><SectionTitle title="Impor dan ekspor data" /><p className="mb-3 text-sm text-slate-600">Setiap file impor divalidasi sebelum dimasukkan. Baris tidak valid ditampilkan; data asli tidak diubah diam-diam.</p><div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => fileRef.current?.click()}><Upload size={16} />Impor CSV/JSON</Button><input ref={fileRef} type="file" accept=".csv,.json,application/json,text/csv" className="hidden" onChange={importFile} /><Button variant="secondary" onClick={() => downloadText(exportFilename('csv'), listingsToCsv(listings), 'text/csv;charset=utf-8')}><FileSpreadsheet size={16} />Ekspor CSV</Button><Button variant="secondary" onClick={() => downloadText(exportFilename('json'), JSON.stringify(listingsToExport(listings, mode), null, 2), 'application/json')}><FileJson size={16} />Ekspor JSON</Button><Button variant="secondary" onClick={() => downloadText('samphone-template.csv', templateCsv(), 'text/csv;charset=utf-8')}><FileDown size={16} />Unduh templat CSV</Button></div>{importReport && <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm"><p>Berhasil diimpor: {importReport.imported} · Baris valid: {importReport.validCount ?? 0}</p>{importReport.errors.map((error, index) => <p className="mt-1 text-rose-700" key={index}>Baris {(error.index ?? 0) + 1}: {error.message}</p>)}</div>}{mode === 'demo' && <div className="mt-5 border-t border-slate-100 pt-4"><Button variant="danger" onClick={async () => { if (window.confirm('Hapus semua perubahan demo dan kembalikan data contoh?')) await resetDemo() }}>Atur ulang data demo</Button></div>}</Card></div></div></>
}

export function LoginPage() {
  const { configured, signIn, signUp, enterDemo, connection } = useAuth()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useDocumentTitle('Masuk')
  async function submit(event) { event.preventDefault(); setBusy(true); setMessage(''); try { if (mode === 'register') { const result = await signUp(email, password, name); setMessage(result.session ? 'Akun dibuat dan sesi aktif.' : 'Akun dibuat. Periksa email untuk konfirmasi, lalu masuk kembali.') } else { await signIn(email, password) } } catch (error) { setMessage(error.message || 'Autentikasi gagal.') } finally { setBusy(false) } }
  return <main className="grid min-h-screen bg-slate-50 lg:grid-cols-[1.05fr_0.95fr]"><section className="hidden flex-col justify-between bg-[#0b1c33] p-12 text-white lg:flex"><div><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-white/10"><Smartphone /></div><div className="font-semibold">Samphone <span className="font-normal text-slate-300">Intelligence</span></div></div><div className="mt-24 max-w-lg"><p className="text-sm font-medium text-blue-200">INTELIJEN HARGA PRIBADI</p><h1 className="mt-4 text-4xl font-semibold leading-tight">Keputusan jual-beli iPhone, berbasis catatan Anda.</h1><p className="mt-5 leading-7 text-slate-300">Kumpulkan iklan, bandingkan harga penawaran, dan hitung batas beli dengan data yang transparan.</p></div></div><p className="text-xs text-slate-400">Untuk penggunaan pribadi · Jawa Timur, Indonesia</p></section><section className="flex items-center justify-center p-5"><div className="w-full max-w-md"><div className="mb-8 lg:hidden"><div className="font-semibold text-slate-900">Samphone Intelligence</div></div><h2 className="text-2xl font-semibold">{configured ? mode === 'login' ? 'Masuk ke akun' : 'Buat akun' : 'Mulai dengan mode demo'}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{configured ? 'Gunakan akun Supabase Anda untuk mengakses data pribadi.' : 'Supabase belum dikonfigurasi. Mode demo memakai data contoh dan penyimpanan lokal.'}</p>{configured ? <form onSubmit={submit} className="mt-6 space-y-4">{mode === 'register' && <Field label="Nama"><input required className={inputClass} value={name} onChange={(event) => setName(event.target.value)} /></Field>}<Field label="Email"><input required type="email" className={inputClass} value={email} onChange={(event) => setEmail(event.target.value)} /></Field><Field label="Kata sandi"><input required minLength={6} type="password" className={inputClass} value={password} onChange={(event) => setPassword(event.target.value)} /></Field><Button className="w-full" disabled={busy}>{busy ? 'Memproses…' : mode === 'login' ? 'Masuk' : 'Daftar'}</Button><button type="button" className="w-full text-sm text-blue-700" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setMessage('') }}>{mode === 'login' ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk'}</button><p className="text-xs text-slate-500">Status Supabase: {connection}</p></form> : <Button className="mt-6 w-full" onClick={enterDemo}>Lanjutkan ke mode demo</Button>}{message && <p role="status" className="mt-4 rounded-xl bg-slate-100 p-3 text-sm text-slate-700">{message}</p>}<p className="mt-6 text-xs leading-5 text-slate-500">Tidak ada akses Facebook otomatis atau API AI berbayar. Dalam demo, data contoh bukan data pasar nyata.</p></div></section></main>
}
