import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { logRegistro } from '../../utils/registro'
import {
    Plus, Loader2, Check, X, MoreVertical, DollarSign,
    ChevronDown, User2, Calendar, TrendingUp, Clock
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

function cn(...c) { return c.filter(Boolean).join(' ') }

const ModalRegistrarPago = ({ onClose, onSaved, clienteId = null }) => {
    const { user } = useAuth()
    const [clientes, setClientes] = useState([])
    const [sesiones, setSesiones] = useState([])
    const [form, setForm] = useState({ cliente_id: clienteId || '', sesion_id: '', importe: '', fecha_pago: format(new Date(), 'yyyy-MM-dd'), metodo: 'efectivo', notas: '' })
    const [loading, setLoading] = useState(false)
    const [loadingSes, setLoadingSes] = useState(false)

    useEffect(() => {
        supabase.from('usuarios').select('id, nombre').eq('rol', 'cliente').order('nombre')
            .then(({ data }) => setClientes(data || []))
    }, [])

    useEffect(() => {
        if (!form.cliente_id) { setSesiones([]); return }
        setLoadingSes(true)
        supabase.from('sesiones').select('*').eq('cliente_id', form.cliente_id)
            .eq('estado', 'realizada').eq('pago_estado', 'pendiente').order('fecha', { ascending: false })
            .then(({ data }) => { setSesiones(data || []); setLoadingSes(false) })
    }, [form.cliente_id])

    const handleSubmit = async () => {
        if (!form.cliente_id || !form.importe) return
        setLoading(true)
        try {
            const { data: pago, error } = await supabase.from('pagos').insert({
                cliente_id: form.cliente_id,
                owner_id: user?.id,
                sesion_id: form.sesion_id || null,
                importe: parseFloat(form.importe),
                fecha_pago: form.fecha_pago,
                metodo: form.metodo,
                notas: form.notas
            }).select().single()
            if (error) throw error

            // Marcar sesión como pagada si se vinculó
            if (form.sesion_id) {
                await supabase.from('sesiones').update({ pago_estado: 'pagado', pago_fecha: form.fecha_pago })
                    .eq('id', form.sesion_id)
            }

            await logRegistro({
                accion: 'registrar_pago', entidad: 'pago', entidad_id: pago.id,
                modulo_origen: 'pagos', cliente_id: form.cliente_id,
                valor_nuevo: { importe: form.importe, fecha: form.fecha_pago },
                impacto_economico: parseFloat(form.importe), autor_id: user?.id
            })
            onSaved()
            onClose()
        } catch (e) { alert(e.message) }
        finally { setLoading(false) }
    }

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-end sm:items-center justify-center p-0 sm:p-6">
            <div className="bg-[#111318] border border-white/10 w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6" style={{ boxShadow: '0 0 60px rgba(0,0,0,0.9)' }}>
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-black text-white">Registrar pago</h3>
                    <button onClick={onClose} className="p-2 bg-white/5 rounded-full hover:bg-white/10"><X className="w-5 h-5 text-white/50" /></button>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="text-xs text-white/40 font-bold uppercase tracking-wider mb-1 block">Cliente *</label>
                        <select value={form.cliente_id} onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value, sesion_id: '' }))}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm outline-none">
                            <option value="" className="bg-[#111318]">Seleccionar cliente...</option>
                            {clientes.map(c => <option key={c.id} value={c.id} className="bg-[#111318]">{c.nombre}</option>)}
                        </select>
                    </div>
                    {form.cliente_id && (
                        <div>
                            <label className="text-xs text-white/40 font-bold uppercase tracking-wider mb-1 block">Sesión (opcional)</label>
                            <select value={form.sesion_id} onChange={e => setForm(f => ({ ...f, sesion_id: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm outline-none">
                                <option value="" className="bg-[#111318]">Sin vincular sesión</option>
                                {loadingSes ? <option disabled className="bg-[#111318]">Cargando...</option> :
                                    sesiones.map(s => <option key={s.id} value={s.id} className="bg-[#111318]">{s.fecha} {s.hora_inicio} – {s.hora_fin}</option>)}
                            </select>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-white/40 font-bold uppercase tracking-wider mb-1 block">Importe (€) *</label>
                            <input type="number" min="0" step="0.01" value={form.importe} onChange={e => setForm(f => ({ ...f, importe: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm outline-none" placeholder="0.00" />
                        </div>
                        <div>
                            <label className="text-xs text-white/40 font-bold uppercase tracking-wider mb-1 block">Fecha</label>
                            <input type="date" value={form.fecha_pago} onChange={e => setForm(f => ({ ...f, fecha_pago: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm outline-none" />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-white/40 font-bold uppercase tracking-wider mb-1 block">Método</label>
                        <select value={form.metodo} onChange={e => setForm(f => ({ ...f, metodo: e.target.value }))}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm outline-none">
                            <option value="efectivo" className="bg-[#111318]">Efectivo</option>
                            <option value="transferencia" className="bg-[#111318]">Transferencia</option>
                            <option value="bizum" className="bg-[#111318]">Bizum</option>
                            <option value="otro" className="bg-[#111318]">Otro</option>
                        </select>
                    </div>
                </div>
                <div className="flex gap-3 mt-6">
                    <button onClick={handleSubmit} disabled={loading || !form.cliente_id || !form.importe}
                        className="flex-1 py-4 bg-[#22c55e]/20 text-[#22c55e] rounded-2xl font-black text-sm border border-[#22c55e]/30 hover:bg-[#22c55e]/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Registrar
                    </button>
                    <button onClick={onClose} className="px-6 py-4 bg-white/5 text-white/50 rounded-2xl font-black text-sm hover:bg-white/10">Cancelar</button>
                </div>
            </div>
        </div>
    )
}

const Pagos = () => {
    const { user } = useAuth()
    const [pagos, setPagos] = useState([])
    const [sesiones, setSesiones] = useState([])
    const [clientes, setClientes] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [tabActiva, setTabActiva] = useState('global') // global | por_cliente
    const [clienteSeleccionado, setClienteSeleccionado] = useState('')
    const [menuSesionId, setMenuSesionId] = useState(null)

    const fetchData = async () => {
        setLoading(true)
        const [{ data: pgs }, { data: ses }, { data: clis }] = await Promise.all([
            supabase.from('pagos').select('*, clientes:usuarios!pagos_cliente_id_fkey(nombre)').order('fecha_pago', { ascending: false }),
            supabase.from('sesiones').select('*, clientes:usuarios!sesiones_cliente_id_fkey(nombre)').order('fecha', { ascending: false }),
            supabase.from('usuarios').select('id, nombre').eq('rol', 'cliente').order('nombre')
        ])
        setPagos(pgs || [])
        setSesiones(ses || [])
        setClientes(clis || [])
        setLoading(false)
    }

    useEffect(() => { fetchData() }, [])

    const mes = new Date().getMonth()
    const anio = new Date().getFullYear()
    const pagosMes = pagos.filter(p => { const d = new Date(p.fecha_pago); return d.getMonth() === mes && d.getFullYear() === anio })
    const totalMes = pagosMes.reduce((a, p) => a + parseFloat(p.importe || 0), 0)
    const totalPendiente = sesiones.filter(s => s.estado === 'realizada' && s.pago_estado === 'pendiente').reduce((a, s) => a + (parseFloat(s.importe) || 0), 0)

    const handleTogglePago = async (sesion) => {
        const nuevoPago = sesion.pago_estado === 'pendiente' ? 'pagado' : 'pendiente'
        await supabase.from('sesiones').update({ pago_estado: nuevoPago, pago_fecha: nuevoPago === 'pagado' ? format(new Date(), 'yyyy-MM-dd') : null }).eq('id', sesion.id)
        await logRegistro({
            accion: nuevoPago === 'pagado' ? 'marcar_pagada' : 'marcar_pendiente',
            entidad: 'sesion', entidad_id: sesion.id,
            modulo_origen: 'pagos', cliente_id: sesion.cliente_id,
            valor_anterior: { pago_estado: sesion.pago_estado }, valor_nuevo: { pago_estado: nuevoPago },
            autor_id: user?.id
        })
        setMenuSesionId(null)
        fetchData()
    }

    const sesFiltradas = clienteSeleccionado
        ? sesiones.filter(s => s.cliente_id === clienteSeleccionado)
        : sesiones

    const clientesResumen = clientes.map(c => {
        const sesCli = sesiones.filter(s => s.cliente_id === c.id)
        const realizadas = sesCli.filter(s => s.estado === 'realizada')
        const pagadas = realizadas.filter(s => s.pago_estado === 'pagado')
        const pendientes = realizadas.filter(s => s.pago_estado === 'pendiente')
        const pagosCli = pagos.filter(p => p.cliente_id === c.id)
        const totalPagado = pagosCli.reduce((a, p) => a + parseFloat(p.importe || 0), 0)
        const totalPend = pendientes.reduce((a, s) => a + (parseFloat(s.importe) || 0), 0)
        return { ...c, realizadas: realizadas.length, pagadas: pagadas.length, pendientes: pendientes.length, totalPagado, totalPend }
    }).filter(c => c.realizadas > 0)

    return (
        <div className="p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h2 className="text-xl font-black text-white">Pagos</h2>
                    <p className="text-white/35 text-xs mt-0.5">Control económico</p>
                </div>
                <button onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#22c55e]/15 text-[#22c55e] rounded-2xl font-bold text-sm border border-[#22c55e]/30 hover:bg-[#22c55e]/25 transition-colors">
                    <Plus className="w-4 h-4" /> Registrar pago
                </button>
            </div>

            {/* Resumen global */}
            <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                    { label: 'Cobrado\neste mes', value: `${totalMes.toFixed(0)}€`, color: '#22c55e' },
                    { label: 'Pendiente\ncobro', value: `${totalPendiente.toFixed(0)}€`, color: '#f97316' },
                    { label: 'Pagos\nregistrados', value: pagos.length, color: '#a78bfa' },
                ].map(m => (
                    <div key={m.label} className="bg-white/5 border border-white/8 rounded-2xl p-3 text-center">
                        <p className="text-xl font-black" style={{ color: m.color }}>{m.value}</p>
                        <p className="text-white/35 text-[9px] font-bold uppercase tracking-wider mt-0.5 whitespace-pre-line">{m.label}</p>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex bg-white/5 rounded-2xl p-1 mb-5">
                {[['global', 'Global'], ['por_cliente', 'Por cliente'], ['sesiones', 'Sesiones']].map(([id, label]) => (
                    <button key={id} onClick={() => setTabActiva(id)}
                        className={cn('flex-1 py-2 rounded-xl text-xs font-bold transition-all',
                            tabActiva === id ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60')}>
                        {label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 text-[#22c55e] animate-spin" /></div>
            ) : tabActiva === 'global' ? (
                <div className="space-y-2">
                    {pagos.length > 0 ? pagos.map(p => (
                        <div key={p.id} className="bg-white/5 border border-white/8 rounded-2xl p-4 flex items-center gap-3">
                            <div className="w-9 h-9 bg-[#22c55e]/15 rounded-full flex items-center justify-center shrink-0">
                                <DollarSign className="w-4 h-4 text-[#22c55e]" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-white font-bold text-sm">{p.clientes?.nombre}</p>
                                <p className="text-white/35 text-xs">{p.fecha_pago} · {p.metodo}</p>
                            </div>
                            <p className="text-[#22c55e] font-black text-base">{parseFloat(p.importe).toFixed(2)}€</p>
                        </div>
                    )) : <p className="text-center text-white/25 text-sm py-8">Sin pagos registrados</p>}
                </div>
            ) : tabActiva === 'por_cliente' ? (
                <div className="space-y-3">
                    {clientesResumen.map(c => (
                        <div key={c.id} className="bg-white/5 border border-white/8 rounded-2xl p-4">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-9 h-9 bg-[#22c55e]/15 rounded-full flex items-center justify-center text-[#22c55e] font-black text-sm">
                                    {c.nombre?.charAt(0)?.toUpperCase()}
                                </div>
                                <div className="flex-1">
                                    <p className="text-white font-bold text-sm">{c.nombre}</p>
                                    <p className="text-white/35 text-xs">{c.realizadas} realizadas</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div>
                                    <p className="text-[#22c55e] font-black">{c.totalPagado.toFixed(0)}€</p>
                                    <p className="text-white/30 text-[9px] uppercase">Cobrado</p>
                                </div>
                                <div>
                                    <p className="text-amber-400 font-black">{c.totalPend.toFixed(0)}€</p>
                                    <p className="text-white/30 text-[9px] uppercase">Pendiente</p>
                                </div>
                                <div>
                                    <p className="text-white/60 font-black">{c.pagadas}/{c.realizadas}</p>
                                    <p className="text-white/30 text-[9px] uppercase">Pagadas</p>
                                </div>
                            </div>
                        </div>
                    ))}
                    {clientesResumen.length === 0 && <p className="text-center text-white/25 text-sm py-8">Sin datos económicos</p>}
                </div>
            ) : (
                // Tab sesiones
                <div>
                    <select value={clienteSeleccionado} onChange={e => setClienteSeleccionado(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm outline-none mb-4">
                        <option value="" className="bg-[#111318]">Todos los clientes</option>
                        {clientes.map(c => <option key={c.id} value={c.id} className="bg-[#111318]">{c.nombre}</option>)}
                    </select>
                    <div className="space-y-2">
                        {sesFiltradas.filter(s => s.estado === 'realizada').map(s => (
                            <div key={s.id} className="bg-white/5 border border-white/8 rounded-2xl p-4 flex items-center gap-3 relative">
                                <div className={cn('w-2 h-2 rounded-full shrink-0', s.pago_estado === 'pagado' ? 'bg-[#22c55e]' : 'bg-amber-400')} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-white font-bold text-sm">{s.clientes?.nombre}</p>
                                    <p className="text-white/35 text-xs">{s.fecha} · {s.hora_inicio}</p>
                                </div>
                                <button onClick={() => handleTogglePago(s)}
                                    className={cn('px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors',
                                        s.pago_estado === 'pagado'
                                            ? 'bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/30 hover:bg-white/5 hover:text-white/50 hover:border-white/10'
                                            : 'bg-amber-400/15 text-amber-400 border-amber-400/30 hover:bg-[#22c55e]/15 hover:text-[#22c55e] hover:border-[#22c55e]/30'
                                    )}>
                                    {s.pago_estado === 'pagado' ? '✓ Pagada' : 'Pendiente'}
                                </button>
                            </div>
                        ))}
                        {sesFiltradas.filter(s => s.estado === 'realizada').length === 0 &&
                            <p className="text-center text-white/25 text-sm py-8">Sin sesiones realizadas</p>}
                    </div>
                </div>
            )}

            {showModal && <ModalRegistrarPago onClose={() => setShowModal(false)} onSaved={fetchData} />}
            {menuSesionId && <div className="fixed inset-0 z-40" onClick={() => setMenuSesionId(null)} />}
        </div>
    )
}

export default Pagos
