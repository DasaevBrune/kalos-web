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

type Step = 'service' | 'datetime' | 'confirm' | 'success'

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

const HOURS = ['09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30',
               '15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30']

// ─── Page ────────────────────────────────────────────────────────────────────

export default function BookingPage() {
  const { slug } = useParams<{ slug: string }>()

  const [business, setBusiness] = useState<Business | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // booking state
  const [step, setStep] = useState<Step>('service')
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedDay, setSelectedDay] = useState<Date>(new Date())
  const [selectedHour, setSelectedHour] = useState<string | null>(null)
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // ── Load business + services ──────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      // 1. Find business by slug
      const { data: biz, error: bizErr } = await supabase
        .from('businesses')
        .select('id, name, slug, owner_profile_id')
        .eq('slug', slug)
        .eq('active', true)
        .single()

      if (bizErr || !biz) { setNotFound(true); setLoading(false); return }

      // 2. Load barber profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, display_name, logo_url, display_address, phone')
        .eq('id', biz.owner_profile_id)
        .single()

      setBusiness({ ...biz, barber: profile as Barber })

      // 3. Load services
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

  // ── Submit booking ────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!business || !selectedService || !selectedHour || !clientName.trim() || !clientPhone.trim()) return
    setSubmitting(true)
    setSubmitError('')

    // Build starts_at from selectedDay + selectedHour
    const [h, m] = selectedHour.split(':').map(Number)
    const startsAt = new Date(selectedDay)
    startsAt.setHours(h, m, 0, 0)

    // Use SECURITY DEFINER RPC — bypasses RLS for anon users
    const { error } = await supabase.rpc('create_booking', {
      p_barber_id: business.barber.id,
      p_client_name: clientName.trim(),
      p_client_phone: clientPhone.trim(),
      p_client_email: '',
      p_service_id: selectedService.id,
      p_starts_at: startsAt.toISOString(),
      p_duration_minutes: selectedService.duration_minutes,
      p_amount: selectedService.price,
    })

    if (error) {
      setSubmitError('Error al crear la cita. Inténtalo de nuevo.')
      setSubmitting(false)
      return
    }

    setStep('success')
    setSubmitting(false)
  }

  // ─── Render ───────────────────────────────────────────────────────────────

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

  const dayNames = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
  const monthNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

  return (
    <div className="min-h-screen bg-[#131313] text-[#e5e2e1]" style={{ fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div className="bg-[#1c1b1b] border-b border-[#4d4635]/20 px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#d4af35] flex items-center justify-center">
          <span className="text-[#3c2f00] font-black text-sm">K</span>
        </div>
        <span className="text-[#f2ca4f] font-bold text-sm tracking-widest uppercase">Kalos</span>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8">

        {/* Barber profile card */}
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
                <span className="w-2 h-2 rounded-full bg-green-400"></span>
                <span className="text-[10px] text-[#b7b5b4] uppercase tracking-widest">Disponible</span>
              </div>
              <h1 className="text-[#e5e2e1] text-xl font-bold">{barber.display_name ?? business!.name}</h1>
              {barber.display_address && (
                <p className="text-[#b7b5b4] text-xs mt-0.5">{barber.display_address}</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Step: service ─────────────────────────────────────────────── */}
        {step === 'service' && (
          <div>
            <h2 className="text-[#f2ca4f] text-xs uppercase tracking-widest font-bold mb-4">Elige un servicio</h2>
            {services.length === 0 ? (
              <p className="text-[#b7b5b4] text-sm">Este barbero aún no tiene servicios configurados.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {services.map(svc => (
                  <button
                    key={svc.id}
                    onClick={() => { setSelectedService(svc); setStep('datetime') }}
                    className="w-full flex items-center justify-between p-5 bg-[#1c1b1b] rounded-xl border border-[#4d4635]/20 hover:border-[#f2ca4f]/50 transition-colors text-left group"
                  >
                    <div>
                      <p className="text-[#e5e2e1] font-medium text-sm">{svc.name}</p>
                      {svc.description && <p className="text-[#b7b5b4] text-xs mt-0.5">{svc.description}</p>}
                      <p className="text-[#b7b5b4] text-xs mt-1">{svc.duration_minutes} min</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[#f2ca4f] font-bold">${Number(svc.price).toFixed(0)}</span>
                      <span className="text-[#f2ca4f] opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Step: datetime ────────────────────────────────────────────── */}
        {step === 'datetime' && selectedService && (
          <div>
            <button onClick={() => setStep('service')} className="text-[#b7b5b4] text-xs mb-5 flex items-center gap-1 hover:text-[#f2ca4f] transition-colors">
              ← Cambiar servicio
            </button>

            {/* Selected service summary */}
            <div className="bg-[#201f1f] rounded-xl px-4 py-3 mb-6 flex justify-between items-center border border-[#4d4635]/15">
              <span className="text-[#e5e2e1] text-sm">{selectedService.name}</span>
              <span className="text-[#f2ca4f] font-bold text-sm">${Number(selectedService.price).toFixed(0)} · {selectedService.duration_minutes}min</span>
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
                    <span className="text-[10px] uppercase tracking-wider">{dayNames[day.getDay()]}</span>
                    <span className="text-lg font-bold leading-none">{day.getDate()}</span>
                    <span className="text-[10px]">{monthNames[day.getMonth()]}</span>
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

            <button
              onClick={() => selectedHour && setStep('confirm')}
              disabled={!selectedHour}
              className="w-full py-4 rounded-xl font-bold text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-[#d4af35] text-[#3c2f00] hover:opacity-90 shadow-[0_0_20px_rgba(212,175,53,0.25)]"
            >
              Continuar →
            </button>
          </div>
        )}

        {/* ── Step: confirm ─────────────────────────────────────────────── */}
        {step === 'confirm' && selectedService && selectedHour && (
          <div>
            <button onClick={() => setStep('datetime')} className="text-[#b7b5b4] text-xs mb-5 flex items-center gap-1 hover:text-[#f2ca4f] transition-colors">
              ← Cambiar horario
            </button>

            {/* Summary */}
            <div className="bg-[#201f1f] rounded-xl p-4 mb-6 border border-[#4d4635]/15 flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#b7b5b4]">Servicio</span>
                <span className="text-[#e5e2e1] font-medium">{selectedService.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#b7b5b4]">Día</span>
                <span className="text-[#e5e2e1]">{dayNames[selectedDay.getDay()]} {selectedDay.getDate()} {monthNames[selectedDay.getMonth()]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#b7b5b4]">Hora</span>
                <span className="text-[#e5e2e1]">{selectedHour}</span>
              </div>
              <div className="flex justify-between border-t border-[#4d4635]/20 pt-2 mt-1">
                <span className="text-[#b7b5b4]">Total</span>
                <span className="text-[#f2ca4f] font-bold">${Number(selectedService.price).toFixed(0)}</span>
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

            {submitError && (
              <p className="text-red-400 text-xs mb-4">{submitError}</p>
            )}

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

        {/* ── Step: success ─────────────────────────────────────────────── */}
        {step === 'success' && selectedService && selectedHour && (
          <div className="text-center py-8">
            <div className="w-20 h-20 rounded-full bg-[#d4af35]/10 border border-[#d4af35]/30 flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl">✓</span>
            </div>
            <h2 className="text-[#e5e2e1] text-2xl font-bold mb-2">¡Cita confirmada!</h2>
            <p className="text-[#b7b5b4] text-sm mb-8">
              {barber.display_name} te espera el{' '}
              {dayNames[selectedDay.getDay()]} {selectedDay.getDate()} de {monthNames[selectedDay.getMonth()]} a las {selectedHour}.
            </p>
            <div className="bg-[#1c1b1b] rounded-xl p-4 text-left border border-[#4d4635]/15 mb-8 text-sm flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="text-[#b7b5b4]">Servicio</span>
                <span className="text-[#e5e2e1]">{selectedService.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#b7b5b4]">Duración</span>
                <span className="text-[#e5e2e1]">{selectedService.duration_minutes} min</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#b7b5b4]">Total a pagar</span>
                <span className="text-[#f2ca4f] font-bold">${Number(selectedService.price).toFixed(0)}</span>
              </div>
            </div>
            <p className="text-[#b7b5b4] text-xs opacity-60">
              Recibirás un recordatorio antes de tu cita.
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
