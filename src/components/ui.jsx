import { useEffect } from 'react'

export function cn(...parts) {
  return parts.filter(Boolean).join(' ')
}

export const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-[#1d4e89] focus:ring-2 focus:ring-blue-100'

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = `${title} · Samphone Intelligence`
  }, [title])
}

export function Button({ variant = 'primary', className, type = 'button', ...props }) {
  const variants = {
    primary: 'bg-[#0b1c33] text-white hover:bg-[#163155]',
    secondary: 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50',
    ghost: 'text-slate-600 hover:bg-slate-100',
    danger: 'bg-rose-700 text-white hover:bg-rose-800',
  }
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}

export function Field({ label, hint, error, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs leading-5 text-slate-500">{hint}</span> : null}
      {error ? <span className="mt-1 block text-xs text-rose-600">{error}</span> : null}
    </label>
  )
}

export function Card({ className, children }) {
  return <section className={cn('rounded-2xl border border-slate-200 bg-white p-5', className)}>{children}</section>
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}

export function Badge({ tone = 'neutral', children }) {
  const tones = {
    neutral: 'bg-slate-100 text-slate-700',
    info: 'bg-blue-50 text-blue-800',
    profit: 'bg-emerald-50 text-emerald-800',
    risk: 'bg-rose-50 text-rose-700',
    warn: 'bg-amber-50 text-amber-800',
  }
  return <span className={cn('inline-flex rounded-full px-2.5 py-1 text-xs font-medium', tones[tone])}>{children}</span>
}

export function AskingPriceNotice() {
  return (
    <p className="text-xs leading-5 text-slate-500">
      Angka ini dihitung dari harga penawaran iklan yang dikumpulkan, bukan dari harga transaksi yang sudah terjadi.
    </p>
  )
}

export function EmptyState({ title, body, action }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function Modal({ open, title, body, confirmLabel = 'Lanjutkan', danger, busy, onConfirm, onClose }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button variant={danger ? 'danger' : 'primary'} disabled={busy} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  )
}

export function StatCard({ label, value, hint, tone }) {
  const tones = { profit: 'text-emerald-700', risk: 'text-rose-700', info: 'text-[#1d4e89]' }
  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cn('mt-2 text-2xl font-semibold tracking-tight', tones[tone] || 'text-slate-950')}>{value}</p>
      {hint ? <p className="mt-2 text-xs leading-5 text-slate-500">{hint}</p> : null}
    </Card>
  )
}

export function Definition({ items }) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{item.label}</dt>
          <dd className="mt-1 text-sm text-slate-900">{item.value || '—'}</dd>
        </div>
      ))}
    </dl>
  )
}
