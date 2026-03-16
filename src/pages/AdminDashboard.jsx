import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
    Menu, X, Calendar, BookOpen, Users, Settings, LogOut,
    Plus, Lock, List, DollarSign, ChevronLeft, User2, Loader2
} from 'lucide-react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { supabase } from '../lib/supabase'
import { logRegistro } from '../utils/registro'
import { format } from 'date-fns'

// Owner modules
import SharedCalendar from './SharedCalendar'
import Diario from './owner/Diario'
import OwnerClientes from './owner/OwnerClientes'
import Registro from './owner/Registro'
import Pagos from './owner/Pagos'
import OwnerConfiguracion from './owner/OwnerConfiguracion'

function cn(...inputs) { return twMerge(clsx(inputs)) }

// Helper iOS
const isIOS = () => typeof window !== 'undefined' &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Mac') && 'ontouchend' in document))

// ─── MODAL ACCIONES RÁPIDAS ────────────────────────────────────────────────────
const ModalNuevoCliente = ({ onClose, onCreated }) => {
    const { user } = useAuth()
    const [form, setForm] = useState({ nombre: '', email: '', sesiones_semanales: 1, precio: 0 })
    const [loading, setLoading] = useState(false)

    const handleSave = async () => {
        if (!form.nombre.trim()) return
        setLoading(true)
        try {
            const { data, error } = await supabase.from('usuarios').insert({
                nombre: form.nombre.trim(),
                email: form.email.trim() || `c${Date.now()}@ev.app`,
                rol: 'cliente'
            }).select().single()
            if (error) throw error
            await supabase.from('clientes_estructura').insert({
                usuario_id: data.id,
                sesiones_semanales: form.sesiones_semanales,
                precio_por_sesion: parseFloat(form.precio) || 0,
                distribucion_semanal: ['lun'],
                hora_habitual: '10:00', estado: 'activo'
            })
            await logRegistro({ accion: 'crear_cliente', entidad: 'cliente', entidad_id: data.id, modulo_origen: 'acciones_rapidas', cliente_id: data.id, autor_id: user?.id, valor_nuevo: form })
            onCreated?.()
            onClose()
        } catch (e) { alert(e.message) } finally { setLoading(false) }
    }

    return (
        <QuickModal title="Nuevo cliente" onClose={onClose}>
            <div className="space-y-3">
                <QInput label="Nombre *" value={form.nombre} onChange={v => setForm(f => ({ ...f, nombre: v }))} placeholder="Nombre completo" />
                <QInput label="Email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} placeholder="email@ejemplo.com" />
                <div className="grid grid-cols-2 gap-3">
                    <QInput label="Sesiones/sem" type="number" value={form.sesiones_semanales} onChange={v => setForm(f => ({ ...f, sesiones_semanales: v }))} />
                    <QInput label="Precio (€)" type="number" value={form.precio} onChange={v => setForm(f => ({ ...f, precio: v }))} />
                </div>
            </div>
            <QuickModalActions onClose={onClose} onSave={handleSave} loading={loading} saveLabel="Crear cliente" saveColor="#22c55e" />
        </QuickModal>
    )
}

const ModalNuevaSesion = ({ onClose, onCreated }) => {
    const { user } = useAuth()
    const [clientes, setClientes] = React.useState([])
    const [form, setForm] = useState({ cliente_id: '', fecha: format(new Date(), 'yyyy-MM-dd'), hora: '10:00', tipo: 'regular' })
    const [loading, setLoading] = useState(false)

    React.useEffect(() => {
        supabase.from('usuarios').select('id, nombre').eq('rol', 'cliente').order('nombre')
            .then(({ data }) => setClientes(data || []))
    }, [])

    const getHoraFin = (h) => { const [hh, mm] = h.split(':').map(Number); return `${String(hh + 1).padStart(2, '0')}:${String(mm).padStart(2, '0')}` }

    const handleSave = async () => {
        if (!form.cliente_id) return
        setLoading(true)
        try {
            const { data, error } = await supabase.from('sesiones').insert({
                cliente_id: form.cliente_id, owner_id: user?.id,
                fecha: form.fecha, hora_inicio: form.hora, hora_fin: getHoraFin(form.hora),
                tipo: form.tipo, estado: 'programada', pago_estado: 'pendiente'
            }).select().single()
            if (error) throw error
            await logRegistro({ accion: 'crear_sesion', entidad: 'sesion', entidad_id: data.id, modulo_origen: 'acciones_rapidas', cliente_id: form.cliente_id, autor_id: user?.id, valor_nuevo: form })
            onCreated?.()
            onClose()
        } catch (e) { alert(e.message) } finally { setLoading(false) }
    }

    const HORAS = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00']

    return (
        <QuickModal title="Nueva sesión" onClose={onClose}>
            <div className="space-y-3">
                <div>
                    <label className="text-xs text-white/40 font-bold mb-1 block uppercase tracking-wider">Cliente *</label>
                    <select value={form.cliente_id} onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm outline-none">
                        <option value="" className="bg-[#111318]">Seleccionar...</option>
                        {clientes.map(c => <option key={c.id} value={c.id} className="bg-[#111318]">{c.nombre}</option>)}
                    </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <QInput label="Fecha" type="date" value={form.fecha} onChange={v => setForm(f => ({ ...f, fecha: v }))} />
                    <div>
                        <label className="text-xs text-white/40 font-bold mb-1 block uppercase tracking-wider">Hora</label>
                        <select value={form.hora} onChange={e => setForm(f => ({ ...f, hora: e.target.value }))}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm outline-none">
                            {HORAS.map(h => <option key={h} value={h} className="bg-[#111318]">{h}</option>)}
                        </select>
                    </div>
                </div>
            </div>
            <QuickModalActions onClose={onClose} onSave={handleSave} loading={loading} saveLabel="Crear sesión" saveColor="#22c55e" />
        </QuickModal>
    )
}

const ModalNuevoBloqueo = ({ onClose, onCreated }) => {
    const { user } = useAuth()
    const [form, setForm] = useState({ fecha: format(new Date(), 'yyyy-MM-dd'), tipo: 'franja', hora_inicio: '09:00', hora_fin: '10:00' })
    const [loading, setLoading] = useState(false)

    const HORAS = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00']

    const handleSave = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase.from('bloqueos').insert({
                owner_id: user?.id, fecha: form.fecha, tipo: form.tipo,
                hora_inicio: form.tipo === 'dia_completo' ? null : form.hora_inicio,
                hora_fin: form.tipo === 'dia_completo' ? null : form.hora_fin,
            }).select().single()
            if (error) throw error
            await logRegistro({ accion: 'crear_bloqueo', entidad: 'bloqueo', entidad_id: data.id, modulo_origen: 'acciones_rapidas', valor_nuevo: form, autor_id: user?.id })
            onCreated?.()
            onClose()
        } catch (e) { alert(e.message) } finally { setLoading(false) }
    }

    return (
        <QuickModal title="Nuevo bloqueo" onClose={onClose}>
            <div className="space-y-3">
                <QInput label="Fecha" type="date" value={form.fecha} onChange={v => setForm(f => ({ ...f, fecha: v }))} />
                <div>
                    <label className="text-xs text-white/40 font-bold mb-2 block uppercase tracking-wider">Tipo de bloqueo</label>
                    <div className="flex gap-2">
                        {[['dia_completo', 'Día completo'], ['franja', 'Franja'], ['huecos_libres', 'Huecos libres']].map(([v, l]) => (
                            <button key={v} onClick={() => setForm(f => ({ ...f, tipo: v }))}
                                className={cn('flex-1 py-2 rounded-xl text-xs font-bold border transition-all',
                                    form.tipo === v ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-white/5 text-white/40 border-white/10')}>
                                {l}
                            </button>
                        ))}
                    </div>
                </div>
                {form.tipo !== 'dia_completo' && (
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-white/40 font-bold mb-1 block uppercase tracking-wider">Inicio</label>
                            <select value={form.hora_inicio} onChange={e => setForm(f => ({ ...f, hora_inicio: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm outline-none">
                                {HORAS.map(h => <option key={h} value={h} className="bg-[#111318]">{h}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-white/40 font-bold mb-1 block uppercase tracking-wider">Fin</label>
                            <select value={form.hora_fin} onChange={e => setForm(f => ({ ...f, hora_fin: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm outline-none">
                                {HORAS.map(h => <option key={h} value={h} className="bg-[#111318]">{h}</option>)}
                            </select>
                        </div>
                    </div>
                )}
            </div>
            <QuickModalActions onClose={onClose} onSave={handleSave} loading={loading} saveLabel="Bloquear" saveColor="#ef4444" />
        </QuickModal>
    )
}

// ── Helpers de modal ──────────────────────────────────────────────────────────
const QuickModal = ({ title, onClose, children }) => (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[500] flex items-end sm:items-center justify-center p-0 sm:p-6">
        <div className="bg-[#111318] border border-white/10 w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6" style={{ boxShadow: '0 0 60px rgba(0,0,0,0.9)' }}>
            <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-black text-white">{title}</h3>
                <button onClick={onClose} className="p-2 bg-white/5 rounded-full hover:bg-white/10"><X className="w-4 h-4 text-white/50" /></button>
            </div>
            {children}
        </div>
    </div>
)

const QInput = ({ label, value, onChange, placeholder, type = 'text' }) => (
    <div>
        <label className="text-xs text-white/40 font-bold mb-1 block uppercase tracking-wider">{label}</label>
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm outline-none focus:border-white/25 transition-colors" />
    </div>
)

const QuickModalActions = ({ onClose, onSave, loading, saveLabel, saveColor }) => (
    <div className="flex gap-3 mt-5">
        <button onClick={onSave} disabled={loading}
            className="flex-1 py-3.5 rounded-2xl font-black text-sm border disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
            style={{ backgroundColor: `${saveColor}25`, color: saveColor, borderColor: `${saveColor}40` }}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : saveLabel}
        </button>
        <button onClick={onClose} className="px-5 py-3.5 bg-white/5 text-white/50 rounded-2xl font-bold text-sm hover:bg-white/10 transition-colors">Cancelar</button>
    </div>
)

// ─── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────────
const AdminDashboard = () => {
    const { signOut, profile } = useAuth()
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [activeSection, setActiveSection] = useState('calendario')
    const [quickModal, setQuickModal] = useState(null) // 'cliente' | 'sesion' | 'bloqueo'
    const [navContext, setNavContext] = useState(null) // extra data para nav

    const iosPad = isIOS() ? { paddingTop: 'calc(3.5rem + env(safe-area-inset-top, 0px))' } : {}

    const navigate = (section, context = null) => {
        setActiveSection(section)
        setNavContext(context)
        setSidebarOpen(false)
    }

    const SECTION_LABELS = {
        calendario: 'Calendario',
        diario: 'Diario',
        clientes: 'Clientes',
        registro: 'Registro',
        pagos: 'Pagos',
        configuracion: 'Configuración'
    }

    const MODULE_NAV = [
        { id: 'diario', label: 'Diario', icon: List },
        { id: 'clientes', label: 'Clientes', icon: Users },
        { id: 'registro', label: 'Registro', icon: BookOpen },
        { id: 'pagos', label: 'Pagos', icon: DollarSign },
        { id: 'configuracion', label: 'Configuración', icon: Settings },
    ]

    const QUICK_ACTIONS = [
        { id: 'cliente', label: 'Nuevo cliente', icon: User2, color: '#22c55e' },
        { id: 'sesion', label: 'Nueva sesión', icon: Calendar, color: '#60a5fa' },
        { id: 'bloqueo', label: 'Nuevo bloqueo', icon: Lock, color: '#ef4444' },
    ]

    return (
        <div className="h-[100dvh] w-full bg-[#0a0c0b] font-sans overflow-hidden">
            <div className="max-w-md mx-auto h-full relative" style={{ background: 'radial-gradient(circle at top, #1a1f1a 0%, #0a0c0b 100%)' }}>

                {/* OVERLAY */}
                {sidebarOpen && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40" onClick={() => setSidebarOpen(false)} />
                )}

                {/* ── SIDEBAR ── */}
                <aside className={cn(
                    'absolute top-0 left-0 h-full w-72 border-r border-white/8 z-50 flex flex-col transition-transform duration-300 ease-out',
                    sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                )} style={{ background: '#0a0c0b', boxShadow: '4px 0 40px rgba(0,0,0,0.7)' }}>

                    {/* Logo + cerrar */}
                    <div className="flex items-center justify-between p-6 pb-4 border-b border-white/5" style={iosPad}>
                        <div>
                            <p className="text-[9px] text-[#f97316]/60 font-black uppercase tracking-widest">Owner Panel</p>
                            <h2 className="text-xl font-black text-gradient-neon">Evidentia</h2>
                        </div>
                        <button onClick={() => setSidebarOpen(false)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
                            <X className="w-5 h-5 text-white/50" />
                        </button>
                    </div>

                    {/* Avatar admin */}
                    <div className="flex items-center gap-3 mx-5 my-4 p-3 bg-white/5 rounded-2xl border border-white/8 shrink-0">
                        <div className="w-9 h-9 bg-[#f97316]/15 rounded-full flex items-center justify-center text-[#f97316] font-black"
                            style={{ boxShadow: '0 0 10px rgba(249,115,22,0.3)' }}>
                            {profile?.nombre?.charAt(0) || 'A'}
                        </div>
                        <div className="min-w-0">
                            <p className="text-white font-bold text-sm truncate">{profile?.nombre || 'Admin'}</p>
                            <p className="text-white/30 text-xs truncate">{profile?.email}</p>
                        </div>
                    </div>

                    {/* ── A. RETORNO AL CALENDARIO ── */}
                    <div className="px-5 mb-2">
                        <button onClick={() => navigate('calendario')}
                            className={cn(
                                'w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-black transition-all border',
                                activeSection === 'calendario'
                                    ? 'bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/30'
                                    : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10 hover:text-white'
                            )}
                            style={activeSection === 'calendario' ? { boxShadow: '0 0 15px rgba(34,197,94,0.15)' } : {}}>
                            <Calendar className="w-5 h-5 shrink-0" />
                            Volver al Calendario
                        </button>
                    </div>

                    {/* ── B. MÓDULOS ── */}
                    <div className="px-5 flex-1 overflow-y-auto">
                        <p className="text-[9px] text-white/25 font-black uppercase tracking-widest mb-2 px-1">Módulos</p>
                        <nav className="space-y-1">
                            {MODULE_NAV.map(({ id, label, icon: Icon }) => (
                                <button key={id} onClick={() => navigate(id)}
                                    className={cn(
                                        'w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all text-sm font-bold',
                                        activeSection === id
                                            ? 'bg-[#f97316]/15 text-[#f97316] border border-[#f97316]/30'
                                            : 'text-white/40 hover:bg-white/5 hover:text-white border border-transparent'
                                    )}
                                    style={activeSection === id ? { boxShadow: '0 0 12px rgba(249,115,22,0.15)' } : {}}>
                                    <Icon className="w-5 h-5 shrink-0" />
                                    {label}
                                </button>
                            ))}
                        </nav>

                        {/* ── C. ACCIONES RÁPIDAS ── */}
                        <p className="text-[9px] text-white/25 font-black uppercase tracking-widest mt-6 mb-2 px-1">Acciones rápidas</p>
                        <div className="space-y-1">
                            {QUICK_ACTIONS.map(({ id, label, icon: Icon, color }) => (
                                <button key={id} onClick={() => { setQuickModal(id); setSidebarOpen(false) }}
                                    className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-sm font-bold text-white/50 hover:bg-white/5 hover:text-white transition-all border border-transparent border-dashed hover:border-white/10">
                                    <Icon className="w-4 h-4 shrink-0" style={{ color }} />
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ── D. CERRAR SESIÓN ── */}
                    <div className="px-5 py-5 border-t border-white/5 shrink-0" style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}>
                        <button onClick={signOut}
                            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-red-400 hover:bg-red-500/10 transition-colors font-bold text-sm border border-red-500/15">
                            <LogOut className="w-5 h-5 shrink-0" />
                            Cerrar sesión
                        </button>
                    </div>
                </aside>

                {/* ── CONTENIDO PRINCIPAL ── */}
                <div className="flex flex-col h-[100dvh]">
                    {/* Header */}
                    <header
                        className="flex items-center gap-3 px-4 pb-3 pt-4 border-b border-white/8 shrink-0"
                        style={{ background: 'rgba(10,12,11,0.95)', backdropFilter: 'blur(10px)', ...iosPad }}>
                        <button onClick={() => setSidebarOpen(true)}
                            className="p-2.5 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors border border-white/8 shrink-0">
                            <Menu className="w-5 h-5 text-white/70" />
                        </button>
                        <h1 className="text-white font-black text-base flex-1">
                            {SECTION_LABELS[activeSection] || activeSection}
                        </h1>
                        {/* Acceso rápido desde header */}
                        {activeSection === 'calendario' && (
                            <button onClick={() => setQuickModal('sesion')}
                                className="p-2.5 bg-[#22c55e]/10 border border-[#22c55e]/20 rounded-2xl text-[#22c55e] hover:bg-[#22c55e]/20 transition-colors mr-2"
                                title="Nueva sesión">
                                <Plus className="w-5 h-5" />
                            </button>
                        )}
                        {/* Botón Salir (Logout) */}
                        <button onClick={signOut}
                            className="px-4 py-2.5 bg-[#2b47c9] text-white rounded-xl text-xs font-black transition-colors hover:bg-[#1e34a6] shadow-md border border-[#1e34a6]"
                            title="Cerrar sesión">
                            SALIR
                        </button>
                    </header>

                    {/* Main content */}
                    <main className="flex-1 overflow-hidden flex flex-col">
                        {activeSection === 'calendario' && (
                            <SharedCalendar onNavigate={navigate} />
                        )}
                        {activeSection === 'diario' && (
                            <Diario onNavigate={navigate} />
                        )}
                        {activeSection === 'clientes' && (
                            <div className="flex-1 overflow-y-auto">
                                <OwnerClientes onNavigate={navigate} initialClienteId={navContext?.clienteId} />
                            </div>
                        )}
                        {activeSection === 'registro' && (
                            <div className="flex-1 overflow-y-auto">
                                <Registro />
                            </div>
                        )}
                        {activeSection === 'pagos' && (
                            <div className="flex-1 overflow-y-auto">
                                <Pagos />
                            </div>
                        )}
                        {activeSection === 'configuracion' && (
                            <div className="flex-1 overflow-y-auto">
                                <OwnerConfiguracion />
                            </div>
                        )}
                    </main>
                </div>

                {/* ── QUICK ACTION MODALS ── */}
                {quickModal === 'cliente' && <ModalNuevoCliente onClose={() => setQuickModal(null)} onCreated={() => {}} />}
                {quickModal === 'sesion' && <ModalNuevaSesion onClose={() => setQuickModal(null)} onCreated={() => {}} />}
                {quickModal === 'bloqueo' && <ModalNuevoBloqueo onClose={() => setQuickModal(null)} onCreated={() => {}} />}
            </div>
        </div>
    )
}

export default AdminDashboard
