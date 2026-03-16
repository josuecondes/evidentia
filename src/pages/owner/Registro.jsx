import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { FilterX, ChevronDown, Loader2, RotateCcw, ChevronRight } from 'lucide-react'
import { logRegistro } from '../../utils/registro'

function cn(...c) { return c.filter(Boolean).join(' ') }

const ACCIONES = [
    'crear_cliente', 'archivar_cliente', 'eliminar_cliente', 'editar_estructura_cliente',
    'crear_sesion', 'mover_sesion', 'cancelar_sesion', 'editar_sesion', 'eliminar_sesion',
    'marcar_realizada', 'duplicar_sesion', 'crear_bloqueo', 'eliminar_bloqueo', 'editar_bloqueo',
    'registrar_pago', 'marcar_pagada', 'marcar_pendiente',
    'cambiar_configuracion', 'revertir_accion'
]

const MODULOS = ['calendario', 'diario', 'clientes', 'pagos', 'configuracion', 'acciones_rapidas']

const ACCION_LABELS = {
    crear_cliente: 'Crear cliente', archivar_cliente: 'Archivar cliente', eliminar_cliente: 'Eliminar cliente',
    editar_estructura_cliente: 'Editar estructura', crear_sesion: 'Crear sesión', mover_sesion: 'Mover sesión',
    cancelar_sesion: 'Cancelar sesión', editar_sesion: 'Editar sesión', eliminar_sesion: 'Eliminar sesión',
    marcar_realizada: 'Marcar realizada', duplicar_sesion: 'Duplicar sesión',
    crear_bloqueo: 'Bloquear', eliminar_bloqueo: 'Desbloquear', editar_bloqueo: 'Editar bloqueo',
    registrar_pago: 'Registrar pago', marcar_pagada: 'Marcar pagada', marcar_pendiente: 'Marcar pendiente',
    cambiar_configuracion: 'Cambiar configuración', revertir_accion: 'Revertir acción'
}

const ACCION_COLOR = {
    crear_cliente: '#22c55e', archivar_cliente: '#f97316', eliminar_cliente: '#ef4444',
    crear_sesion: '#22c55e', marcar_realizada: '#22c55e', registrar_pago: '#22c55e', marcar_pagada: '#22c55e',
    cancelar_sesion: '#ef4444', eliminar_sesion: '#ef4444',
    mover_sesion: '#a78bfa', editar_sesion: '#a78bfa', editar_estructura_cliente: '#a78bfa',
    revertir_accion: '#f97316',
}

const Registro = () => {
    const { user } = useAuth()
    const [logs, setLogs] = useState([])
    const [loading, setLoading] = useState(true)
    const [clientes, setClientes] = useState([])
    const [expanded, setExpanded] = useState(null)
    const [reverting, setReverting] = useState(null)

    const [filtros, setFiltros] = useState({ cliente_id: '', accion: '', modulo: '', fecha_desde: '', fecha_hasta: '' })

    const fetchLogs = async () => {
        setLoading(true)
        let q = supabase.from('registro').select('*, usuarios!registro_cliente_id_fkey(nombre), autor:usuarios!registro_autor_id_fkey(nombre)')
            .order('created_at', { ascending: false }).limit(100)
        if (filtros.cliente_id) q = q.eq('cliente_id', filtros.cliente_id)
        if (filtros.accion) q = q.eq('accion', filtros.accion)
        if (filtros.modulo) q = q.eq('modulo_origen', filtros.modulo)
        if (filtros.fecha_desde) q = q.gte('created_at', filtros.fecha_desde)
        if (filtros.fecha_hasta) q = q.lte('created_at', filtros.fecha_hasta + 'T23:59:59')
        const { data } = await q
        setLogs(data || [])
        setLoading(false)
    }

    useEffect(() => {
        supabase.from('usuarios').select('id, nombre').eq('rol', 'cliente').order('nombre')
            .then(({ data }) => setClientes(data || []))
    }, [])

    useEffect(() => { fetchLogs() }, [filtros])

    const limpiarFiltros = () => setFiltros({ cliente_id: '', accion: '', modulo: '', fecha_desde: '', fecha_hasta: '' })

    const hayFiltros = Object.values(filtros).some(Boolean)

    const handleRevertir = async (log) => {
        setReverting(log.id)
        await logRegistro({
            accion: 'revertir_accion', entidad: log.entidad, entidad_id: log.entidad_id,
            modulo_origen: 'registro', cliente_id: log.cliente_id,
            valor_anterior: log.valor_nuevo, valor_nuevo: log.valor_anterior,
            autor_id: user?.id, es_reversion: true, reversion_de: log.id
        })
        setReverting(null)
        fetchLogs()
    }

    const reversibles = ['mover_sesion', 'cancelar_sesion', 'editar_sesion', 'editar_estructura_cliente', 'cambiar_configuracion']

    return (
        <div className="p-4">
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h2 className="text-xl font-black text-white">Registro</h2>
                    <p className="text-white/35 text-xs mt-0.5">Trazabilidad de todas las acciones</p>
                </div>
                {hayFiltros && (
                    <button onClick={limpiarFiltros} className="flex items-center gap-1.5 px-3 py-2 bg-white/5 text-white/50 rounded-xl text-xs font-bold hover:bg-white/10 transition-colors border border-white/8">
                        <FilterX className="w-3.5 h-3.5" /> Limpiar
                    </button>
                )}
            </div>

            {/* Filtros */}
            <div className="bg-white/5 border border-white/8 rounded-2xl p-4 mb-5 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider mb-1 block">Cliente</label>
                        <select value={filtros.cliente_id} onChange={e => setFiltros(f => ({ ...f, cliente_id: e.target.value }))}
                            className="w-full bg-[#0f1014] border border-white/10 rounded-xl px-3 py-2 text-white text-xs outline-none">
                            <option value="" className="bg-[#0f1014]">Todos</option>
                            {clientes.map(c => <option key={c.id} value={c.id} className="bg-[#0f1014]">{c.nombre}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider mb-1 block">Acción</label>
                        <select value={filtros.accion} onChange={e => setFiltros(f => ({ ...f, accion: e.target.value }))}
                            className="w-full bg-[#0f1014] border border-white/10 rounded-xl px-3 py-2 text-white text-xs outline-none">
                            <option value="" className="bg-[#0f1014]">Todas</option>
                            {ACCIONES.map(a => <option key={a} value={a} className="bg-[#0f1014]">{ACCION_LABELS[a] || a}</option>)}
                        </select>
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                    <div>
                        <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider mb-1 block">Módulo</label>
                        <select value={filtros.modulo} onChange={e => setFiltros(f => ({ ...f, modulo: e.target.value }))}
                            className="w-full bg-[#0f1014] border border-white/10 rounded-xl px-3 py-2 text-white text-xs outline-none">
                            <option value="" className="bg-[#0f1014]">Todos</option>
                            {MODULOS.map(m => <option key={m} value={m} className="bg-[#0f1014]">{m}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider mb-1 block">Desde</label>
                        <input type="date" value={filtros.fecha_desde} onChange={e => setFiltros(f => ({ ...f, fecha_desde: e.target.value }))}
                            className="w-full bg-[#0f1014] border border-white/10 rounded-xl px-3 py-2 text-white text-xs outline-none" />
                    </div>
                    <div>
                        <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider mb-1 block">Hasta</label>
                        <input type="date" value={filtros.fecha_hasta} onChange={e => setFiltros(f => ({ ...f, fecha_hasta: e.target.value }))}
                            className="w-full bg-[#0f1014] border border-white/10 rounded-xl px-3 py-2 text-white text-xs outline-none" />
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 text-[#22c55e] animate-spin" /></div>
            ) : logs.length > 0 ? (
                <div className="space-y-2">
                    {logs.map(log => {
                        const isExp = expanded === log.id
                        const canRevert = reversibles.includes(log.accion) && !log.es_reversion
                        const color = ACCION_COLOR[log.accion] || '#a78bfa'
                        const fecha = new Date(log.created_at)
                        return (
                            <div key={log.id} className={cn('bg-white/5 border rounded-2xl overflow-hidden transition-all', isExp ? 'border-white/20' : 'border-white/8')}>
                                <button className="w-full flex items-center gap-3 px-4 py-3.5 text-left" onClick={() => setExpanded(isExp ? null : log.id)}>
                                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white font-bold text-sm">{ACCION_LABELS[log.accion] || log.accion}</p>
                                        <p className="text-white/35 text-xs truncate">
                                            {log.usuarios?.nombre || 'Sistema'} · {log.modulo_origen}
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-white/40 text-xs">{fecha.toLocaleDateString('es', { day: '2-digit', month: 'short' })}</p>
                                        <p className="text-white/25 text-[10px]">{fecha.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                    <ChevronDown className={cn('w-4 h-4 text-white/30 shrink-0 transition-transform', isExp && 'rotate-180')} />
                                </button>
                                {isExp && (
                                    <div className="px-4 pb-4 border-t border-white/5 pt-3">
                                        <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                                            {log.valor_anterior && (
                                                <div className="bg-red-500/10 rounded-xl p-2">
                                                    <p className="text-red-300/60 font-bold mb-1">Anterior</p>
                                                    <pre className="text-red-200/80 text-[10px] whitespace-pre-wrap break-all">{JSON.stringify(JSON.parse(log.valor_anterior), null, 2)}</pre>
                                                </div>
                                            )}
                                            {log.valor_nuevo && (
                                                <div className="bg-[#22c55e]/10 rounded-xl p-2">
                                                    <p className="text-[#22c55e]/60 font-bold mb-1">Nuevo</p>
                                                    <pre className="text-[#22c55e]/80 text-[10px] whitespace-pre-wrap break-all">{JSON.stringify(JSON.parse(log.valor_nuevo), null, 2)}</pre>
                                                </div>
                                            )}
                                        </div>
                                        {log.es_reversion && <p className="text-amber-400/70 text-xs mb-2">↩ Esta es una reversión de otra acción</p>}
                                        {canRevert && (
                                            <button onClick={() => handleRevertir(log)} disabled={reverting === log.id}
                                                className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-400 rounded-xl text-xs font-bold border border-amber-500/20 hover:bg-amber-500/20 transition-colors disabled:opacity-50">
                                                {reverting === log.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                                                Revertir
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            ) : (
                <div className="text-center py-16">
                    <p className="text-white/25 text-sm">No hay registros{hayFiltros ? ' para los filtros aplicados' : ' aún'}</p>
                </div>
            )}
        </div>
    )
}

export default Registro
