import { useEffect, useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Check, Clipboard } from 'lucide-react'
import { useAppData } from './context/AppDataContext'
import { MODELS, REGIONS, STORAGES } from './lib/constants'
import { formatPercent, formatRupiah } from './lib/format'
import { buildAdText, buildSellPlan } from './lib/selling'
import { AskingPriceNotice, Badge, Button, Card, EmptyState, PageHeader, cn, inputClass, useDocumentTitle } from './components/ui'

const PREFS_KEY = 'samphone.sell.prefs.v1'
const DEFAULT_PREFS = { bargainPct: 5, windowDays: 45, removeOutliers: true }
const WINDOWS = [{ value: 30, label: '30 hari terakhir' }, { value: 45, label: '45 hari terakhir' }, { value: 90, label: '90 hari terakhir' }, { value: 0, label: 'Semua data' }]
const LOCKS = [{ value: 'open', label: 'Terbuka (bebas operator)' }, { value: 'restricted', label: 'Terkunci / RSIM' }, { value: '', label: 'Semua' }]
const TIER_HINT = {
  fast: 'Sekitar kuartil bawah pembanding. Biasanya paling cepat mendapat tawaran.',
  market: 'Median pembanding. Titik tengah pasar.',
  ambitious: 'Sekitar kuartil atas. Hanya untuk unit yang jelas lebih baik dari pembanding.',
}

function usePrefs() {
  const [prefs, setPrefs] = useState(() => {
    try {
      const raw = window.localStorage.getItem(PREFS_KEY)
      return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS
    } catch {
      return DEFAULT_PREFS
    }
  })
  useEffect(() => {
    try { window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)) } catch { /* penyimpanan tidak tersedia */ }
  }, [prefs])
  return [prefs, setPrefs]
}

function Select({ label, value, onChange, options, placeholder }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      <select className={inputClass} value={value} onChange={(event) => onChange(event.target.value)}>
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => {
          const item = typeof option === 'object' ? option : { value: option, label: option }
          return <option key={item.value} value={item.value}>{item.label}</option>
        })}
      </select>
    </label>
  )
}

function NumberInput({ label, hint, value, onChange, placeholder = 'Rp', step = 1000 }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      <input type="number" min="0" step={step} className={inputClass} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      {hint ? <span className="mt-1 block text-xs leading-5 text-slate-500">{hint}</span> : null}
    </label>
  )
}

const num = (value) => (value === '' || value == null ? null : Number(value))

export function SellPricePage() {
  useDocumentTitle('Harga Jual')
  const { listings, settings } = useAppData()
  const [prefs, setPrefs] = usePrefs()
  const [unit, setUnit] = useState({ model: '', storage: '', region: '', lock: 'open', battery: '', purchase: '', minProfit: settings.targetProfit, cost: settings.operationalCost })
  const set = (key, value) => setUnit((state) => ({ ...state, [key]: value }))

  useEffect(() => {
    setUnit((state) => ({ ...state, minProfit: settings.targetProfit, cost: settings.operationalCost }))
  }, [settings.targetProfit, settings.operationalCost])

  const ready = unit.model && unit.storage && unit.region
  const plan = useMemo(() => {
    if (!ready) return null
    return buildSellPlan(listings, {
      model: unit.model, storage: unit.storage, region: unit.region, lock: unit.lock,
      windowDays: prefs.windowDays, removeOutliers: prefs.removeOutliers, bargainPct: prefs.bargainPct,
      battery: num(unit.battery), purchasePrice: num(unit.purchase),
      minProfit: num(unit.minProfit) ?? 0, operationalCost: num(unit.cost) ?? 0,
    })
  }, [listings, ready, unit, prefs])

  const qualityTone = plan?.quality?.level === 'preliminary' ? 'warn' : plan?.quality?.level === 'moderate' ? 'info' : 'profit'

  return (
    <>
      <PageHeader
        title="Harga jual"
        description="Tentukan harga pasang iPhone yang akan Anda jual berdasarkan iklan sejenis yang sudah Anda kumpulkan. Hasilnya adalah panduan, bukan jaminan harga laku."
      />
      <Card>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Select label="Model iPhone" value={unit.model} onChange={(v) => set('model', v)} options={MODELS} placeholder="Pilih…" />
          <Select label="Penyimpanan" value={unit.storage} onChange={(v) => set('storage', v)} options={STORAGES} placeholder="Pilih…" />
          <Select label="Wilayah unit" value={unit.region} onChange={(v) => set('region', v)} options={REGIONS.filter((r) => r !== 'Tidak diketahui')} placeholder="Pilih…" />
          <Select label="Kunci operator" value={unit.lock} onChange={(v) => set('lock', v)} options={LOCKS} />
          <NumberInput label="Kesehatan baterai unit Anda (%)" placeholder="%" step={1} value={unit.battery} onChange={(v) => set('battery', v)} hint="Opsional. Jika ada cukup pembanding dengan baterai serupa, merekalah yang dipakai." />
          <NumberInput label="Harga beli unit (Rp)" value={unit.purchase} onChange={(v) => set('purchase', v)} hint="Opsional. Diisi agar laba dan batas bawah dihitung." />
          <NumberInput label="Laba minimum (Rp)" value={unit.minProfit} onChange={(v) => set('minProfit', v)} />
          <NumberInput label="Biaya operasional (Rp)" value={unit.cost} onChange={(v) => set('cost', v)} hint="Transportasi, aksesoris, biaya lain." />
          <NumberInput label="Perkiraan tawar (%)" placeholder="%" step={1} value={prefs.bargainPct} onChange={(v) => setPrefs((p) => ({ ...p, bargainPct: v === '' ? 0 : Number(v) }))} hint="Rata-rata penurunan dari harga pasang sampai laku. Diganti angka nyata jika Anda punya 3+ transaksi." />
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div className="w-52"><Select label="Usia data pembanding" value={prefs.windowDays} onChange={(v) => setPrefs((p) => ({ ...p, windowDays: Number(v) }))} options={WINDOWS} /></div>
          <label className="inline-flex items-center gap-2 pb-2.5 text-sm text-slate-700">
            <input type="checkbox" checked={prefs.removeOutliers} onChange={(event) => setPrefs((p) => ({ ...p, removeOutliers: event.target.checked }))} />
            Buang harga yang terlalu ekstrem (IQR)
          </label>
        </div>
      </Card>

      {!ready ? (
        <div className="mt-5"><EmptyState title="Pilih unit yang akan dijual" body="Pilih model, penyimpanan, dan wilayah unit. iBox dan internasional tidak digabung." /></div>
      ) : !plan.ok ? (
        <div className="mt-5">
          <EmptyState
            title="Data pembanding belum cukup"
            body={`Ditemukan ${plan.count} iklan aktif/negosiasi yang cocok dalam rentang waktu ini (${plan.baseCount} tanpa batas waktu). Butuh minimal 3. Tambah iklan sejenis lewat menu Tambah Iklan, atau perluas "Usia data pembanding".`}
          />
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Badge tone={qualityTone}>{plan.quality.label}</Badge>
            <Badge>{plan.count} pembanding</Badge>
            {plan.removedOutliers > 0 && <Badge tone="warn">{plan.removedOutliers} harga ekstrem dibuang</Badge>}
            {plan.usedBatteryMatch && <Badge tone="info">Hanya baterai serupa</Badge>}
            {plan.batteryBucket !== 'unknown' && !plan.usedBatteryMatch && <Badge tone="warn">Pembanding baterai serupa kurang dari 3, memakai semua</Badge>}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {plan.tiers.map((tier) => {
              const isRecommended = plan.recommended === tier.key
              return (
                <div key={tier.key} className={cn('rounded-2xl border p-5', isRecommended ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200 bg-white')}>
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-base font-semibold text-slate-900">{tier.label}</h2>
                    {isRecommended && <Badge tone="profit">Disarankan</Badge>}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{TIER_HINT[tier.key]}</p>
                  <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">Harga pasang</p>
                  <p className="text-2xl font-semibold tracking-tight text-slate-950">{formatRupiah(tier.listPrice)}</p>
                  <p className="mt-3 text-sm text-slate-600">Perkiraan laku: <strong>{formatRupiah(tier.expectedSale)}</strong></p>
                  {tier.profit != null && (
                    <p className={cn('mt-1 text-sm', tier.meetsMin ? 'text-emerald-700' : 'text-rose-700')}>
                      Laba bersih: <strong>{formatRupiah(tier.profit)}</strong> · {tier.meetsMin ? 'memenuhi laba minimum' : 'di bawah laba minimum'}
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          <Card className="mt-5">
            <h2 className="text-base font-semibold text-slate-900">Saran</h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">{plan.advice}</p>
            {plan.floorList != null && (
              <p className="mt-3 text-sm leading-6 text-slate-700">
                <strong>Batas bawah:</strong> agar laba minimum tercapai, harga laku tidak boleh kurang dari <strong>{formatRupiah(plan.floorSale)}</strong>. Artinya harga pasang minimal sekitar <strong>{formatRupiah(plan.floorList)}</strong>. {plan.floorAbove} dari {plan.count} pembanding dipasang di harga itu atau lebih tinggi.
              </p>
            )}
            <p className="mt-3 text-xs leading-5 text-slate-500">
              {plan.measuredRatio != null
                ? `Faktor tawar diukur dari ${plan.measuredCount} transaksi Anda: rata-rata laku di ${formatPercent(plan.measuredRatio * 100)} dari harga pasang.`
                : `Faktor tawar memakai asumsi ${formatPercent(prefs.bargainPct)}. Catat "harga jual aktual" di iklan yang sudah laku agar angka ini menjadi nyata.`}
            </p>
          </Card>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <Card>
              <h2 className="text-base font-semibold text-slate-900">Pengaruh kesehatan baterai</h2>
              <table className="mt-3 w-full text-sm">
                <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500"><th className="pb-2 font-medium">Baterai</th><th className="pb-2 font-medium">Iklan</th><th className="pb-2 text-right font-medium">Median</th></tr></thead>
                <tbody>
                  {plan.batteryTable.map((row) => (
                    <tr key={row.key} className="border-t border-slate-100"><td className="py-2">{row.label}</td><td className="py-2">{row.count}</td><td className="py-2 text-right">{row.count >= 2 ? formatRupiah(row.median) : '—'}</td></tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-xs leading-5 text-slate-500">Median dengan kurang dari 2 iklan tidak ditampilkan. Selisih antar baris menunjukkan berapa pasar menghargai baterai.</p>
            </Card>
            <Card>
              <h2 className="text-base font-semibold text-slate-900">Kecepatan laku</h2>
              {plan.timeToSell ? (
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  Dari {plan.timeToSell.count} iklan sejenis yang ditandai terjual, mediannya sekitar <strong>{Math.round(plan.timeToSell.median)} hari</strong> sejak tayang sampai ditandai terjual. Ini perkiraan, bukan waktu transaksi pasti.
                </p>
              ) : (
                <p className="mt-3 text-sm leading-6 text-slate-500">Belum ada 3 iklan sejenis yang ditandai terjual. Ubah status iklan menjadi "Terjual" saat Anda melihat iklan itu hilang atau laku, agar angka ini muncul.</p>
              )}
            </Card>
          </div>

          <Card className="mt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900">Tren harga iklan per bulan</h2>
              {plan.trendChangePct != null && (
                <Badge tone={plan.trendChangePct < -1 ? 'risk' : plan.trendChangePct > 1 ? 'profit' : 'neutral'}>
                  {plan.trendChangePct > 0 ? '+' : ''}{formatPercent(plan.trendChangePct)} dibanding bulan sebelumnya
                </Badge>
              )}
            </div>
            {plan.trend.length >= 2 ? (
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={plan.trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis tickFormatter={(value) => `${(value / 1e6).toFixed(1)} jt`} domain={['auto', 'auto']} />
                    <Tooltip formatter={(value) => formatRupiah(value)} labelFormatter={(label) => label} />
                    <Line dataKey="median" name="Median" stroke="#2563eb" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Butuh data dari minimal 2 bulan berbeda untuk menampilkan tren.</p>
            )}
            <p className="mt-2 text-xs leading-5 text-slate-500">Bulan dengan kurang dari 3 iklan tidak dipakai untuk persentase perubahan. Harga iPhone lama umumnya turun saat generasi baru rilis.</p>
          </Card>
        </>
      )}

      <AdTextCard unit={unit} plan={plan} />
      <div className="mt-5"><AskingPriceNotice /></div>
    </>
  )
}

function AdTextCard({ unit, plan }) {
  const [form, setForm] = useState({ color: '', price: '', imeiRegistered: false, icloudClean: false, batteryReplaced: false, accessories: '', condition: '', flaws: '', city: '' })
  const [copied, setCopied] = useState(false)
  const set = (key, value) => { setCopied(false); setForm((state) => ({ ...state, [key]: value })) }
  const recommendedPrice = plan?.ok ? plan.tiers.find((tier) => tier.key === (plan.recommended || 'market'))?.listPrice : null
  const text = buildAdText({
    model: unit.model, storage: unit.storage, region: unit.region, lock: unit.lock === 'open' ? 'Terbuka' : '',
    battery: num(unit.battery), ...form, price: num(form.price) ?? recommendedPrice,
  })

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Card className="mt-5">
      <h2 className="text-base font-semibold text-slate-900">Teks iklan</h2>
      <p className="mt-1 text-sm text-slate-500">Centang hanya hal yang sudah Anda cek sendiri. Teks hanya memuat yang Anda isi, tidak menambah klaim.</p>
      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-700">Warna<input className={cn(inputClass, 'mt-1.5')} value={form.color} onChange={(e) => set('color', e.target.value)} /></label>
          <label className="block text-sm font-medium text-slate-700">Harga di iklan (Rp)<input type="number" min="0" step="10000" className={cn(inputClass, 'mt-1.5')} value={form.price} placeholder={recommendedPrice ? `Otomatis ${formatRupiah(recommendedPrice)}` : 'Rp'} onChange={(e) => set('price', e.target.value)} /></label>
          <label className="block text-sm font-medium text-slate-700">Kondisi<input className={cn(inputClass, 'mt-1.5')} value={form.condition} placeholder="mis. mulus, pemakaian normal" onChange={(e) => set('condition', e.target.value)} /></label>
          <label className="block text-sm font-medium text-slate-700">Kelengkapan<input className={cn(inputClass, 'mt-1.5')} value={form.accessories} placeholder="mis. dus, kabel, charger" onChange={(e) => set('accessories', e.target.value)} /></label>
          <label className="block text-sm font-medium text-slate-700">Minus (jujur membantu menghindari komplain)<input className={cn(inputClass, 'mt-1.5')} value={form.flaws} onChange={(e) => set('flaws', e.target.value)} /></label>
          <label className="block text-sm font-medium text-slate-700">Lokasi<input className={cn(inputClass, 'mt-1.5')} value={form.city} placeholder="mis. Surabaya" onChange={(e) => set('city', e.target.value)} /></label>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-700">
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.imeiRegistered} onChange={(e) => set('imeiRegistered', e.target.checked)} />IMEI terdaftar</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.icloudClean} onChange={(e) => set('icloudClean', e.target.checked)} />iCloud bersih</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.batteryReplaced} onChange={(e) => set('batteryReplaced', e.target.checked)} />Baterai pernah diganti</label>
          </div>
        </div>
        <div>
          <pre className="min-h-48 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-800">{text}</pre>
          <Button className="mt-3" variant="secondary" onClick={copy}>{copied ? <Check size={16} /> : <Clipboard size={16} />}{copied ? 'Tersalin' : 'Salin teks'}</Button>
        </div>
      </div>
    </Card>
  )
}
