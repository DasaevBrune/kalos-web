'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Barber {
  id: string
  display_name: string | null
  logo_url: string | null
  display_address: string | null
  phone: string | null
}

interface Business {
  id: string
  name: string
  slug: string
  owner_profile_id: string
  barber: Barber
}

interface Service {
  id: string
  name: string
  duration_minutes: number
  price: number
  description: string | null
}

interface Accompanist {
  key: string
  name: string
  selectedServices: Service[]
}

type Step = 'service' | 'accompanists' | 'datetime' | 'confirm' | 'success'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function initials(name: string | null): string {
  if (!name) return '??'
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function nextDays(count: number): Date[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return d
  })
}

function totalDuration(services: Service[]): number {
  return services.reduce((s, svc) => s + svc.duration_minutes, 0)
}

function totalPrice(services: Service[]): number {
  return services.reduce((s, svc) => s + Number(svc.price), 0)
}

function serviceDisplayName(services: Service[]): string {
  return services.map(s => s.name).join(' + ')
}

const HOURS = ['09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30',
               '15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30']

const DAY_NAMES  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const MAX_ACCOMPANISTS = 3

// ─── Sub-components ──────────────────────────────────────────────────────────

function Header() {
  return (
    <div className="bg-[#1c1b1b] border-b border-[#4d4635]/20 px-4 py-3 flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-[#d4af35] flex items-center justify-center">
        <span className="text-[#3c2f00] font-black text-sm">K</span>
      </div>
      <span className="text-[#f2ca4f] font-bold text-sm tracking-widest uppercase">Kalos</span>
    </div>
  )
}

function BarberCard({ barber, businessName }: { barber: Barber; businessName: string }) {
  return (
    <div className="bg-[#1c1b1b] rounded-2xl p-6 mb-6 border border-[#4d4635]/20">
      <div className="flex items-center gap-4">
        {barber.logo_url ? (
          <img src={barber.logo_url} alt={barber.display_name ?? ''} className="w-16 h-16 rounded-full object-cover border border-[#f2ca4f]/20" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-[#2a2a2a] border border-[#f2ca4f]/20 flex items-center justify-center flex-shrink-0">
            <span className="text-[#f2ca4f] font-bold text-lg">{initials(barber.display_name)}</span>
          </div>
        )}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-[10px] text-[#b7b5b4] uppercase tracking-widest">Disponible</span>
          </div>
          <h1 className="text-[#e5e2e1] text-xl font-bold">{barber.display_name ?? businessName}</h1>
          {barber.display_address && (
            <p className="text-[#b7b5b4] text-xs mt-0.5">{barber.display_address}</p>
          )}
        </div>
      </div>
    </div>
  )
}

function BackBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-[#b7b5b4] text-xs mb-5 flex items-center gap-1 hover:text-[#f2ca4f] transition-colors">
      ← {label}
    </button>
  )
}

function GoldBtn({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full py-4 rounded-xl font-bold text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-[#d4af35] text-[#3c2f00] hover:opacity-90 shadow-[0_0_20px_rgba(212,175,53,0.25)]"
    >
      {label}
    </button>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function BookingPage() {
  const { slug } = useParams<{ slug: string }>()

  const [business, setBusiness]   = useState<Business | null>(null)
  const [services, setServices]   = useState<Service[]>([])
  const [loading, setLoading]     = useState(true)
  const [notFound, setNotFound]   = useState(false)

  // booking state
  const [step, setStep]                         = useState<Step>('service')
  const [selectedServices, setSelectedServices] = useState<Service[]>([])
  const [accompanists, setAccompanists]         = useState<Accompanist[]>([])
  const [selectedDay, setSelectedDay]           = useState<Date>(new Date())
  const [selectedHour, setSelectedHour]         = useState<string | null>(null)
  const [clientName, setClientName]             = useState('')
  const [clientPhone, setClientPhone]           = useState('')
  const [submitting, setSubmitting]             = useState(false)
  const [submitError, setSubmitError]           = useState('')

  // accompanist editing state
  const [editingAccIdx, setEditingAccIdx] = useState<number | null>(null)

  // ── Load business + services ──────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: biz, error: bizErr } = await supabase
        .from('businesses')
        .select('id, name, slug, owner_profile_id')
        .eq('slug', slug)
        .eq('active', true)
        .single()

      if (bizErr || !biz) { setNotFound(true); setLoading(false); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, display_name, logo_url, display_address, phone')
        .eq('id', biz.owner_profile_id)
        .single()

      setBusiness({ ...biz, barber: profile as Barber })

      const { data: svcs } = await supabase
        .from('services')
        .select('id, name, duration_minutes, price, description')
        .eq('barber_id', biz.owner_profile_id)
        .order('price')

      setServices(svcs ?? [])
      setLoading(false)
    }
    load()
  }, [slug])

  // ── Derived totals ────────────────────────────────────────────────────────

  const mainDuration = totalDuration(selectedServices)
  const mainPrice    = totalPrice(selectedServices)
  const accDuration  = accompanists.reduce((s, a) => s + totalDuration(a.selectedServices), 0)
  const accPrice     = accompanists.reduce((s, a) => s + totalPrice(a.selectedServices), 0)
  const grandTotal   = mainPrice + accPrice
  const grandDuration = mainDuration + accDuration

  // ── Helpers ───────────────────────────────────────────────────────────────

  function toggleService(svc: Service) {
    setSelectedServices(prev =>
      prev.find(s => s.id === svc.id)
        ? prev.filter(s => s.id !== svc.id)
        : [...prev, svc]
    )
  }

  function addAccompanist() {
    if (accompanists.length >= MAX_ACCOMPANISTS) return
    const newAcc: Accompanist = { key: crypto.randomUUID(), name: '', selectedServices: [] }
    setAccompanists(prev => [...prev, newAcc])
    setEditingAccIdx(accompanists.length)
  }

  function removeAccompanist(idx: number) {
    setAccompanists(prev => prev.filter((_, i) => i !== idx))
    setEditingAccIdx(null)
  }

  function updateAccompanistName(idx: number, name: string) {
    setAccompanists(prev => prev.map((a, i) => i === idx ? { ...a, name } : a))
  }

  function toggleAccompanistService(idx: number, svc: Service) {
    setAccompanists(prev => prev.map((a, i) => {
      if (i !== idx) return a
      const has = a.selectedServices.find(s => s.id === svc.id)
      return {
        ...a,
        selectedServices: has
          ? a.selectedServices.filter(s => s.id !== svc.id)
          : [...a.selectedServices, svc],
      }
    }))
  }

  function accompanistsValid(): boolean {
    return accompanists.every(a => a.name.trim() !== '' && a.selectedServices.length > 0)
  }

  // ── Submit booking ────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!business || selectedServices.length === 0 || !selectedHour || !clientName.trim() || !clientPhone.trim()) return
    setSubmitting(true)
    setSubmitError('')

    const [h, m] = selectedHour.split(':').map(Number)
    const startsAt = new Date(selectedDay)
    startsAt.setHours(h, m, 0, 0)

    const accompJsonb = accompanists.length > 0
      ? {
          count: accompanists.length,
          people: accompanists.map(a => ({
            name: a.name.trim(),
            services: a.selectedServices.map(s => ({
              serviceId: s.id,
              serviceName: s.name,
              duration: s.duration_minutes,
              price: Number(s.price),
            })),
          })),
        }
      : null

    const { error } = await supabase.rpc('create_booking', {
      p_barber_id:           business.barber.id,
      p_client_name:         clientName.trim(),
      p_client_phone:        clientPhone.trim(),
      p_client_email:        '',
      p_service_id:          selectedServices[0].id,
      p_starts_at:           startsAt.toISOString(),
      p_duration_minutes:    mainDuration,
      p_amount:              mainPrice,
      p_service_display_name: serviceDisplayName(selectedServices),
      p_accompanists:        accompJsonb,
    })

    if (error) {
      setSubmitError('Error al crear la cita. Inténtalo de nuevo.')
      setSubmitting(false)
      return
    }

    setStep('success')
    setSubmitting(false)
  }

  // ─── Render guards ────────────────────────────────────────────────────────

  if (loading) return (
    <div className="min-h-screen bg-[#131313] flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-[#f2ca4f] border-t-transparent animate-spin" />
    </div>
  )

  if (notFound) return (
    <div className="min-h-screen bg-[#131313] flex flex-col items-center justify-center px-6 text-center">
      <span className="text-5xl mb-4">✂️</span>
      <h1 className="text-[#e5e2e1] text-2xl font-bold mb-2">Barbero no encontrado</h1>
      <p className="text-[#b7b5b4] text-sm">Verifica que el enlace sea correcto.</p>
    </div>
  )

  const { barber } = business!
  const days = nextDays(7)

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#131313] text-[#e5e2e1]" style={{ fontFamily: 'system-ui, sans-serif' }}>
      <Header />

      <div className="max-w-lg mx-auto px-4 py-8">
        <BarberCard barber={barber} businessName={business!.name} />

        {/* ── Step: service ───────────────────────────────────────────────── */}
        {step === 'service' && (
          <div>
            <h2 className="text-[#f2ca4f] text-xs uppercase tracking-widest font-bold mb-4">
              Elige uno o más servicios
            </h2>

            {services.length === 0 ? (
              <p className="text-[#b7b5b4] text-sm">Este barbero aún no tiene servicios configurados.</p>
            ) : (
              <div className="flex flex-col gap-3 mb-6">
                {services.map(svc => {
                  const selected = !!selectedServices.find(s => s.id === svc.id)
                  return (
                    <button
                      key={svc.id}
                      onClick={() => toggleService(svc)}
                      className={`w-full flex items-center justify-between p-5 rounded-xl border transition-all text-left ${
                        selected
                          ? 'bg-[#d4af35]/10 border-[#f2ca4f]/60'
                          : 'bg-[#1c1b1b] border-[#4d4635]/20 hover:border-[#f2ca4f]/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          selected ? 'bg-[#d4af35] border-[#d4af35]' : 'border-[#4d4635]/60'
                        }`}>
                          {selected && <span className="text-[#3c2f00] text-xs font-black">✓</span>}
                        </div>
                        <div>
                          <p className="text-[#e5e2e1] font-medium text-sm">{svc.name}</p>
                          {svc.description && <p className="text-[#b7b5b4] text-xs mt-0.5">{svc.description}</p>}
                          <p className="text-[#b7b5b4] text-xs mt-1">{svc.duration_minutes} min</p>
                        </div>
                      </div>
                      <span className={`font-bold text-sm ml-3 ${selected ? 'text-[#f2ca4f]' : 'text-[#b7b5b4]'}`}>
                        ${Number(svc.price).toFixed(0)}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            {selectedServices.length > 0 && (
              <div className="bg-[#201f1f] rounded-xl px-4 py-3 mb-4 border border-[#4d4635]/15 flex justify-between items-center text-sm">
                <span className="text-[#b7b5b4]">{selectedServices.length} servicio{selectedServices.length > 1 ? 's' : ''} · {mainDuration} min</span>
                <span className="text-[#f2ca4f] font-bold">${mainPrice.toFixed(0)}</span>
              </div>
            )}

            <GoldBtn
              label={selectedServices.length === 0
                ? 'Selecciona al menos un servicio'
                : `Continuar${selectedServices.length > 1 ? ` (${selectedServices.length} servicios)` : ''} →`}
              onClick={() => setStep('accompanists')}
              disabled={selectedServices.length === 0}
            />
          </div>
        )}

        {/* ── Step: accompanists ──────────────────────────────────────────── */}
        {step === 'accompanists' && (
          <div>
            <BackBtn label="Cambiar servicios" onClick={() => setStep('service')} />

            {/* Main client summary */}
            <div className="bg-[#201f1f] rounded-xl px-4 py-3 mb-6 border border-[#4d4635]/15 flex justify-between items-center text-sm">
              <span className="text-[#e5e2e1]">{serviceDisplayName(selectedServices)}</span>
              <span className="text-[#f2ca4f] font-bold">${mainPrice.toFixed(0)} · {mainDuration}min</span>
            </div>

            <h2 className="text-[#f2ca4f] text-xs uppercase tracking-widest font-bold mb-1">
              Acompañantes
            </h2>
            <p className="text-[#b7b5b4] text-xs mb-4">
              ¿Vienen más personas? Agrégalas para reservar todo en una sola cita. (Máx. {MAX_ACCOMPANISTS})
            </p>

            {/* Accompanist cards */}
            <div className="flex flex-col gap-3 mb-4">
              {accompanists.map((acc, idx) => (
                <div key={acc.key} className="bg-[#1c1b1b] rounded-xl border border-[#4d4635]/20 overflow-hidden">
                  {/* Header */}
                  <div
                    className="flex items-center justify-between px-4 py-3 cursor-pointer"
                    onClick={() => setEditingAccIdx(editingAccIdx === idx ? null : idx)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[#f2ca4f] text-sm">👤</span>
                      <span className="text-[#e5e2e1] text-sm font-medium">
                        {acc.name.trim() || `Acompañante ${idx + 1}`}
                      </span>
                      {acc.selectedServices.length > 0 && (
                        <span className="text-[#b7b5b4] text-xs">· ${totalPrice(acc.selectedServices).toFixed(0)}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[#b7b5b4] text-xs">{editingAccIdx === idx ? '▲' : '▼'}</span>
                      <button
                        onClick={e => { e.stopPropagation(); removeAccompanist(idx) }}
                        className="text-[#b7b5b4] hover:text-red-400 text-xs px-1 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Edit panel */}
                  {editingAccIdx === idx && (
                    <div className="px-4 pb-4 border-t border-[#4d4635]/15 pt-3 flex flex-col gap-3">
                      <input
                        type="text"
                        placeholder="Nombre (ej: Mi hijo, María)"
                        value={acc.name}
                        onChange={e => updateAccompanistName(idx, e.target.value)}
                        className="w-full bg-[#131313] border border-[#4d4635]/30 rounded-lg px-3 py-2.5 text-[#e5e2e1] text-sm placeholder:text-[#b7b5b4]/50 focus:outline-none focus:border-[#f2ca4f]/50"
                      />
                      <p className="text-[#b7b5b4] text-xs uppercase tracking-wider">Servicios para esta persona</p>
                      <div className="flex flex-col gap-2">
                        {services.map(svc => {
                          const sel = !!acc.selectedServices.find(s => s.id === svc.id)
                          return (
                            <button
                              key={svc.id}
                              onClick={() => toggleAccompanistService(idx, svc)}
                              className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all text-left ${
                                sel ? 'bg-[#d4af35]/10 border-[#f2ca4f]/50' : 'border-[#4d4635]/20 hover:border-[#f2ca4f]/20'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                                  sel ? 'bg-[#d4af35] border-[#d4af35]' : 'border-[#4d4635]/60'
                                }`}>
                                  {sel && <span className="text-[#3c2f00] text-[9px] font-black">✓</span>}
                                </div>
                                <span className="text-[#e5e2e1] text-sm">{svc.name}</span>
                              </div>
                              <span className="text-[#b7b5b4] text-xs">${Number(svc.price).toFixed(0)}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add accompanist button */}
            {accompanists.length < MAX_ACCOMPANISTS && (
              <button
                onClick={addAccompanist}
                className="w-full py-3 rounded-xl border border-dashed border-[#4d4635]/40 text-[#b7b5b4] text-sm hover:border-[#f2ca4f]/40 hover:text-[#f2ca4f] transition-colors mb-6"
              >
                + Agregar acompañante
              </button>
            )}

            {/* Grand total if accompanists present */}
            {accompanists.length > 0 && (
              <div className="bg-[#201f1f] rounded-xl px-4 py-3 mb-4 border border-[#4d4635]/15 flex flex-col gap-1 text-sm mb-6">
                <div className="flex justify-between">
                  <span className="text-[#b7b5b4]">Tú</span>
                  <span className="text-[#e5e2e1]">${mainPrice.toFixed(0)}</span>
                </div>
                {accompanists.map((a, i) => (
                  <div key={a.key} className="flex justify-between">
                    <span className="text-[#b7b5b4]">{a.name.trim() || `Acompañante ${i + 1}`}</span>
                    <span className="text-[#e5e2e1]">${totalPrice(a.selectedServices).toFixed(0)}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t border-[#4d4635]/20 pt-2 mt-1">
                  <span className="text-[#b7b5b4]">Total · {grandDuration} min</span>
                  <span className="text-[#f2ca4f] font-bold">${grandTotal.toFixed(0)}</span>
                </div>
              </div>
            )}

            <GoldBtn
              label={accompanists.length === 0 ? 'Continuar sin acompañantes →' : 'Continuar →'}
              onClick={() => setStep('datetime')}
              disabled={!accompanistsValid()}
            />
            {!accompanistsValid() && accompanists.length > 0 && (
              <p className="text-[#b7b5b4] text-xs text-center mt-2">
                Completa nombre y al menos un servicio por acompañante
              </p>
            )}
          </div>
        )}

        {/* ── Step: datetime ──────────────────────────────────────────────── */}
        {step === 'datetime' && (
          <div>
            <BackBtn label="Cambiar acompañantes" onClick={() => setStep('accompanists')} />

            <div className="bg-[#201f1f] rounded-xl px-4 py-3 mb-6 border border-[#4d4635]/15 flex justify-between items-center text-sm">
              <span className="text-[#e5e2e1]">
                {serviceDisplayName(selectedServices)}
                {accompanists.length > 0 && ` + ${accompanists.length} acomp.`}
              </span>
              <span className="text-[#f2ca4f] font-bold">${grandTotal.toFixed(0)} · {grandDuration}min</span>
            </div>

            <h2 className="text-[#f2ca4f] text-xs uppercase tracking-widest font-bold mb-4">Elige un día</h2>
            <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
              {days.map(day => {
                const isSelected = day.toDateString() === selectedDay.toDateString()
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => { setSelectedDay(day); setSelectedHour(null) }}
                    className={`flex-shrink-0 flex flex-col items-center gap-1 px-3 py-3 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-[#d4af35] border-[#d4af35] text-[#3c2f00]'
                        : 'bg-[#1c1b1b] border-[#4d4635]/20 text-[#b7b5b4] hover:border-[#f2ca4f]/40'
                    }`}
                  >
                    <span className="text-[10px] uppercase tracking-wider">{DAY_NAMES[day.getDay()]}</span>
                    <span className="text-lg font-bold leading-none">{day.getDate()}</span>
                    <span className="text-[10px]">{MONTH_NAMES[day.getMonth()]}</span>
                  </button>
                )
              })}
            </div>

            <h2 className="text-[#f2ca4f] text-xs uppercase tracking-widest font-bold mb-4">Elige una hora</h2>
            <div className="grid grid-cols-4 gap-2 mb-6">
              {HOURS.map(h => (
                <button
                  key={h}
                  onClick={() => setSelectedHour(h)}
                  className={`py-2.5 rounded-lg text-sm font-medium border transition-all ${
                    selectedHour === h
                      ? 'bg-[#d4af35] border-[#d4af35] text-[#3c2f00]'
                      : 'bg-[#1c1b1b] border-[#4d4635]/20 text-[#e5e2e1] hover:border-[#f2ca4f]/40'
                  }`}
                >
                  {h}
                </button>
              ))}
            </div>

            <GoldBtn label="Continuar →" onClick={() => setStep('confirm')} disabled={!selectedHour} />
          </div>
        )}

        {/* ── Step: confirm ───────────────────────────────────────────────── */}
        {step === 'confirm' && selectedHour && (
          <div>
            <BackBtn label="Cambiar horario" onClick={() => setStep('datetime')} />

            {/* Summary card */}
            <div className="bg-[#201f1f] rounded-xl p-4 mb-6 border border-[#4d4635]/15 flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#b7b5b4]">Servicio</span>
                <span className="text-[#e5e2e1] font-medium text-right max-w-[60%]">{serviceDisplayName(selectedServices)}</span>
              </div>

              {accompanists.length > 0 && (
                <>
                  <div className="border-t border-[#4d4635]/15 pt-2 mt-1">
                    <p className="text-[#b7b5b4] text-xs mb-1">Acompañantes</p>
                    {accompanists.map((a, i) => (
                      <div key={a.key} className="flex justify-between mb-1">
                        <span className="text-[#e5e2e1] text-xs">{a.name} — {serviceDisplayName(a.selectedServices)}</span>
                        <span className="text-[#b7b5b4] text-xs">${totalPrice(a.selectedServices).toFixed(0)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="flex justify-between">
                <span className="text-[#b7b5b4]">Día</span>
                <span className="text-[#e5e2e1]">{DAY_NAMES[selectedDay.getDay()]} {selectedDay.getDate()} {MONTH_NAMES[selectedDay.getMonth()]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#b7b5b4]">Hora</span>
                <span className="text-[#e5e2e1]">{selectedHour}</span>
              </div>
              <div className="flex justify-between border-t border-[#4d4635]/20 pt-2 mt-1">
                <span className="text-[#b7b5b4]">Total · {grandDuration} min</span>
                <span className="text-[#f2ca4f] font-bold">${grandTotal.toFixed(0)}</span>
              </div>
            </div>

            <h2 className="text-[#f2ca4f] text-xs uppercase tracking-widest font-bold mb-4">Tus datos</h2>
            <div className="flex flex-col gap-3 mb-6">
              <input
                type="text"
                placeholder="Tu nombre"
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                className="w-full bg-[#1c1b1b] border border-[#4d4635]/30 rounded-xl px-4 py-3.5 text-[#e5e2e1] text-sm placeholder:text-[#b7b5b4]/50 focus:outline-none focus:border-[#f2ca4f]/50 transition-colors"
              />
              <input
                type="tel"
                placeholder="Tu teléfono"
                value={clientPhone}
                onChange={e => setClientPhone(e.target.value)}
                className="w-full bg-[#1c1b1b] border border-[#4d4635]/30 rounded-xl px-4 py-3.5 text-[#e5e2e1] text-sm placeholder:text-[#b7b5b4]/50 focus:outline-none focus:border-[#f2ca4f]/50 transition-colors"
              />
            </div>

            {submitError && <p className="text-red-400 text-xs mb-4">{submitError}</p>}

            <button
              onClick={handleSubmit}
              disabled={submitting || !clientName.trim() || !clientPhone.trim()}
              className="w-full py-4 rounded-xl font-bold text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-[#d4af35] text-[#3c2f00] hover:opacity-90 shadow-[0_0_20px_rgba(212,175,53,0.25)]"
            >
              {submitting ? 'Reservando...' : 'Confirmar cita'}
            </button>

            <p className="text-[#b7b5b4] text-xs text-center mt-4 opacity-60">
              El pago se realiza en la barbería. Sin cargos online.
            </p>
          </div>
        )}

        {/* ── Step: success ───────────────────────────────────────────────── */}
        {step === 'success' && selectedHour && (
          <div className="text-center py-8">
            <div className="w-20 h-20 rounded-full bg-[#d4af35]/10 border border-[#d4af35]/30 flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl">✓</span>
            </div>
            <h2 className="text-[#e5e2e1] text-2xl font-bold mb-2">¡Cita confirmada!</h2>
            <p className="text-[#b7b5b4] text-sm mb-8">
              {barber.display_name} te espera el{' '}
              {DAY_NAMES[selectedDay.getDay()]} {selectedDay.getDate()} de {MONTH_NAMES[selectedDay.getMonth()]} a las {selectedHour}.
            </p>
            <div className="bg-[#1c1b1b] rounded-xl p-4 text-left border border-[#4d4635]/15 mb-4 text-sm flex flex-col gap-2">
              {/* Main client */}
              <div className="flex justify-between items-start">
                <span className="text-[#b7b5b4]">Tú</span>
                <div className="text-right max-w-[60%]">
                  {selectedServices.map(s => (
                    <p key={s.id} className="text-[#e5e2e1]">{s.name} — ${Number(s.price).toFixed(0)} ({s.duration_minutes} min)</p>
                  ))}
                </div>
              </div>

              {/* Accompanists */}
              {accompanists.length > 0 && (
                <div className="border-t border-[#4d4635]/15 pt-2 mt-1 flex flex-col gap-2">
                  <p className="text-[#b7b5b4] text-xs uppercase tracking-wider">Acompañantes</p>
                  {accompanists.map((a, i) => (
                    <div key={a.key} className="flex justify-between items-start">
                      <span className="text-[#e5e2e1] font-medium">{a.name.trim() || `Acompañante ${i + 1}`}</span>
                      <div className="text-right max-w-[60%]">
                        {a.selectedServices.map(s => (
                          <p key={s.id} className="text-[#b7b5b4]">{s.name} — ${Number(s.price).toFixed(0)} ({s.duration_minutes} min)</p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between border-t border-[#4d4635]/20 pt-2 mt-1">
                <span className="text-[#b7b5b4]">Duración total</span>
                <span className="text-[#e5e2e1]">{grandDuration} min</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#b7b5b4]">Total a pagar</span>
                <span className="text-[#f2ca4f] font-bold">${grandTotal.toFixed(0)}</span>
              </div>
            </div>
            <p className="text-[#b7b5b4] text-xs opacity-60 mt-6">
              El pago se realiza en la barbería. Sin cargos online.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center py-8 border-t border-[#4d4635]/10 mt-8">
        <p className="text-[#b7b5b4] text-xs">
          Reserva gestionada por{' '}
          <span className="text-[#f2ca4f] font-bold">Kalos</span>
        </p>
      </div>
    </div>
  )
}
