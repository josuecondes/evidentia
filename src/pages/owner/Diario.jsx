import React, { useState, useEffect } from 'react'
import { format, addDays, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { logRegistro } from '../../utils/registro'
import {
    ChevronLeft, ChevronRight, Check,
    MoreVertical, X, Loader2, Move, Ban, User2, Lock
} from 'lucide-react'
import { format as fmt } from 'date-fns'
import { ModalSesion, ModalMoverSesion, ModalBloqueo, ModalCancelConfirm, ModalDeleteConfirm } from '../../components/AdminModals'

function cn(...c) { return c.filter(Boolean).join(' ') }

const HORAS = []
for (let h = 9; h <= 20; h++) {
    HORAS.push(`${String(h).padStart(2, '0')}:00`)
    if (h < 20) HORAS.push(`${String(h).padStart(2, '0')}:30`)
}

// ─── DIARIO PRINCIPAL ──────────────────────────────────────────────────────────
const Diario = ({ onNavigate }) => {
    const { user } = useAuth()
    const [dia, setDia] = useState(new Date())
    const [sesiones, setSesiones] = useState([])
    const [bloqueos, setBloqueos] = useState([])
    const [clientes, setClientes] = useState([])
    const [loading, setLoading] = useState(true)

    const [modal, setModal] = useState(null) // null | { type, payload }
    const [menuSesionId, setMenuSesionId] = useState(null)
    const [huecoActivo, setHuecoActivo] = useState(null)
    const [cancelConfirm, setCancelConfirm] = useState(null)
    const [deleteConfirm, setDeleteConfirm] = useState(null)

    const fechaStr = fmt(dia, 'yyyy-MM-dd')

    const fetchDia = async () => {
        setLoading(true)
        const [{ data: ses }, { data: bloq }] = await Promise.all([
            supabase.from('sesiones').select('*, clientes:usuarios!sesiones_cliente_id_fkey(nombre, email)')
                .eq('fecha', fechaStr).order('hora_inicio'),
            supabase.from('bloqueos').select('*').eq('fecha', fechaStr)
        ])
        setSesiones(ses || [])
        setBloqueos(bloq || [])
        setLoading(false)
    }

    useEffect(() => {
        supabase.from('usuarios').select('id, nombre').eq('rol', 'cliente').order('nombre')
            .then(({ data }) => setClientes(data || []))
    }, [])

    useEffect(() => { fetchDia() }, [fechaStr])

    const navDia = (dir) => {
        setDia(prev => dir > 0 ? addDays(prev, 1) : subDays(prev, 1))
    }

    const horaEnBloqueo = (hora) => {
        return bloqueos.some(b => {
            if (b.tipo === 'dia_completo') return true
            if (!b.hora_inicio || !b.hora_fin) return false
            return hora >= b.hora_inicio && hora < b.hora_fin
        })
    }

    const sesionEnHora = (hora) => sesiones.find(s => s.hora_inicio === hora || (s.hora_inicio < hora && s.hora_fin > hora))

    const handleMarkRealizada = async (s) => {
        const nuevo = s.estado === 'realizada' ? 'programada' : 'realizada'
        await supabase.from('sesiones').update({ estado: nuevo, updated_at: new Date().toISOString() }).eq('id', s.id)
        await logRegistro({ accion: 'marcar_realizada', entidad: 'sesion', entidad_id: s.id, modulo_origen: 'diario', cliente_id: s.cliente_id, valor_anterior: { estado: s.estado }, valor_nuevo: { estado: nuevo }, autor_id: user?.id })
        fetchDia()
    }

    const handleCancel = async (s) => {
        await supabase.from('sesiones').update({ estado: 'cancelada', updated_at: new Date().toISOString() }).eq('id', s.id)
        await logRegistro({ accion: 'cancelar_sesion', entidad: 'sesion', entidad_id: s.id, modulo_origen: 'diario', cliente_id: s.cliente_id, valor_anterior: { estado: s.estado }, valor_nuevo: { estado: 'cancelada' }, autor_id: user?.id })
        setCancelConfirm(null)
        fetchDia()
    }

    const handleDelete = async (s) => {
        await supabase.from('sesiones').delete().eq('id', s.id)
        await logRegistro({ accion: 'eliminar_sesion', entidad: 'sesion', entidad_id: s.id, modulo_origen: 'diario', cliente_id: s.cliente_id, autor_id: user?.id })
        setDeleteConfirm(null)
        fetchDia()
    }

    const handleDesbloquear = async (b) => {
        await supabase.from('bloqueos').delete().eq('id', b.id)
        await logRegistro({ accion: 'eliminar_bloqueo', entidad: 'bloqueo', entidad_id: b.id, modulo_origen: 'diario', valor_anterior: b, autor_id: user?.id })
        fetchDia()
    }

    const huecoActual = HORAS.map(hora => {
        const sesion = sesionEnHora(hora)
        const bloqueado = horaEnBloqueo(hora)
        const pasado = new Date(`${fechaStr}T${hora}`) < new Date()
        return { hora, sesion, bloqueado, pasado }
    })

    return (
        <div className="flex flex-col h-full">
            {/* Nav de fecha */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8 shrink-0">
                <button onClick={() => navDia(-1)} className="p-2 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors">
                    <ChevronLeft className="w-5 h-5 text-white/60" />
                </button>
                <div className="flex-1 text-center">
                    <button onClick={() => setDia(new Date())} className="text-center">
                        <p className="text-white font-black capitalize">{format(dia, 'EEEE', { locale: es })}</p>
                        <p className="text-white/40 text-sm">{format(dia, "d 'de' MMMM yyyy", { locale: es })}</p>
                    </button>
                </div>
                <button onClick={() => navDia(1)} className="p-2 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors">
                    <ChevronRight className="w-5 h-5 text-white/60" />
                </button>
            </div>

            {/* Contenido de horas */}
            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 text-[#22c55e] animate-spin" /></div>
                ) : (
                    <div>
                        {/* Bloqueos de día completo */}
                        {bloqueos.filter(b => b.tipo === 'dia_completo').map(b => (
                            <div key={b.id} className="mx-4 mt-3 bg-red-500/10 border border-red-500/20 rounded-2xl p-3 flex items-center gap-3">
                                <Lock className="w-4 h-4 text-red-400 shrink-0" />
                                <p className="text-red-400 font-bold text-sm flex-1">Día completo bloqueado</p>
                                <button onClick={() => handleDesbloquear(b)} className="text-xs text-red-400/60 hover:text-red-400 font-bold">Desbloquear</button>
                            </div>
                        ))}

                        <div className="p-4 space-y-2">
                            {huecoActual.map(({ hora, sesion, bloqueado, pasado }) => {
                                if (sesion && sesion.hora_inicio !== hora) return null // skip continuación

                                if (sesion) {
                                    const isRealizada = sesion.estado === 'realizada'
                                    const isCancelada = sesion.estado === 'cancelada'
                                    return (
                                        <div key={hora} className={cn(
                                            'border rounded-2xl overflow-hidden transition-all',
                                            isCancelada ? 'opacity-50 border-white/8' : isRealizada ? 'border-[#22c55e]/30 bg-[#22c55e]/8' : 'border-[#14532d]/40 bg-white/5'
                                        )} style={{ boxShadow: isCancelada ? 'none' : isRealizada ? '0 0 10px rgba(34,197,94,0.1)' : '0 0 8px rgba(20,83,45,0.1)' }}>
                                            <div className="flex items-center gap-3 px-4 py-3">
                                                <div className="text-center shrink-0 w-10">
                                                    <p className="text-white/60 text-xs font-bold">{sesion.hora_inicio}</p>
                                                    <p className="text-white/30 text-[10px]">{sesion.hora_fin}</p>
                                                </div>
                                                <div className="w-9 h-9 shrink-0 rounded-full bg-[#22c55e]/15 flex items-center justify-center text-[#22c55e] font-black text-sm">
                                                    {sesion.clientes?.nombre?.charAt(0)?.toUpperCase() || '?'}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-white font-bold text-sm truncate">{sesion.clientes?.nombre}</p>
                                                    <div className="flex gap-2 items-center mt-0.5">
                                                        <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                                                            isRealizada ? 'bg-[#22c55e]/15 text-[#22c55e]' :
                                                                isCancelada ? 'bg-red-500/15 text-red-400' : 'bg-white/5 text-white/40')}>
                                                            {isCancelada ? 'Cancelada' : isRealizada ? 'Realizada' : 'Programada'}
                                                        </span>
                                                        <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                                                            sesion.pago_estado === 'pagado' ? 'bg-[#22c55e]/10 text-[#22c55e]/70' : 'bg-amber-400/10 text-amber-400/70')}>
                                                            {sesion.pago_estado === 'pagado' ? '✓ Pagada' : 'Pendiente'}
                                                        </span>
                                                    </div>
                                                </div>
                                                {!isCancelada && (
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        <button onClick={() => handleMarkRealizada(sesion)}
                                                            className={cn('p-2 rounded-xl border transition-all',
                                                                isRealizada ? 'bg-[#22c55e]/20 text-[#22c55e] border-[#22c55e]/30' : 'bg-white/5 text-white/30 border-white/10 hover:text-[#22c55e] hover:border-[#22c55e]/20')}>
                                                            <Check className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => setModal({ type: 'mover', payload: sesion })}
                                                            className="p-2 rounded-xl border border-white/10 bg-white/5 text-white/30 hover:text-[#a78bfa] hover:border-[#a78bfa]/20 transition-all">
                                                            <Move className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => setCancelConfirm(sesion)}
                                                            className="p-2 rounded-xl border border-white/10 bg-white/5 text-white/30 hover:text-red-400 hover:border-red-500/20 transition-all">
                                                            <Ban className="w-4 h-4" />
                                                        </button>
                                                        <div className="relative">
                                                            <button onClick={() => setMenuSesionId(menuSesionId === sesion.id ? null : sesion.id)}
                                                                className="p-2 rounded-xl border border-white/10 bg-white/5 text-white/30 hover:text-white/60 transition-all">
                                                                <MoreVertical className="w-4 h-4" />
                                                            </button>
                                                            {menuSesionId === sesion.id && (
                                                                <div className="absolute right-0 top-full mt-1 w-44 bg-[#1a1d24] border border-white/10 rounded-2xl overflow-hidden z-50 shadow-2xl">
                                                                    <button onClick={() => { onNavigate && onNavigate('clientes', { clienteId: sesion.cliente_id }); setMenuSesionId(null) }}
                                                                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white/70 hover:bg-white/5">
                                                                        <User2 className="w-4 h-4" /> Ver cliente
                                                                    </button>
                                                                    <button onClick={() => { setDeleteConfirm(sesion); setMenuSesionId(null) }}
                                                                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 border-t border-white/5">
                                                                        <X className="w-4 h-4" /> Eliminar
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                }

                                if (bloqueado) {
                                    const bloqueo = bloqueos.find(b => b.tipo !== 'dia_completo' && hora >= (b.hora_inicio || '') && hora < (b.hora_fin || ''))
                                    return (
                                        <div key={hora} className="flex items-center gap-3 px-4 py-2.5 bg-red-500/5 border border-red-500/15 rounded-2xl">
                                            <span className="text-white/30 text-xs w-10 shrink-0">{hora}</span>
                                            <Lock className="w-3.5 h-3.5 text-red-400/50 shrink-0" />
                                            <p className="text-red-400/60 text-xs font-bold flex-1">Bloqueado</p>
                                            {bloqueo && <button onClick={() => handleDesbloquear(bloqueo)}
                                                className="text-xs text-red-300/50 hover:text-red-400 font-bold">Quitar</button>}
                                        </div>
                                    )
                                }

                                // Hueco libre
                                return (
                                    <div key={hora} className={cn(
                                        'flex items-center gap-3 rounded-2xl transition-all',
                                        pasado ? 'opacity-30' : 'cursor-pointer'
                                    )}>
                                        <span className="text-white/25 text-xs w-10 shrink-0 pl-1">{hora}</span>
                                        {huecoActivo === hora ? (
                                            <div className="flex-1 flex gap-2">
                                                <button onClick={() => { setModal({ type: 'sesion', payload: { fecha: fechaStr, hora } }); setHuecoActivo(null) }}
                                                    className="flex-1 py-2 bg-[#22c55e]/15 text-[#22c55e] rounded-xl text-xs font-bold border border-[#22c55e]/25 hover:bg-[#22c55e]/25 transition-colors">
                                                    + Sesión
                                                </button>
                                                <button onClick={() => { setModal({ type: 'bloqueo', payload: { fecha: fechaStr, hora } }); setHuecoActivo(null) }}
                                                    className="flex-1 py-2 bg-red-500/10 text-red-400 rounded-xl text-xs font-bold border border-red-500/20 hover:bg-red-500/20 transition-colors">
                                                    <Lock className="w-3 h-3 inline mr-1" />Bloquear
                                                </button>
                                                <button onClick={() => setHuecoActivo(null)} className="p-2 text-white/30 hover:text-white/50">
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ) : !pasado ? (
                                            <div className="flex-1 py-2.5 border border-dashed border-white/8 rounded-2xl hover:border-white/15 transition-colors"
                                                onClick={() => setHuecoActivo(hora)}>
                                                <p className="text-white/20 text-xs text-center">Libre — tocar para añadir</p>
                                            </div>
                                        ) : (
                                            <div className="flex-1 py-2.5 border border-white/5 rounded-2xl">
                                                <p className="text-white/10 text-xs text-center">Pasado</p>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Modales */}
            {modal?.type === 'sesion' && <ModalSesion horaDia={modal.payload} clientes={clientes} onClose={() => setModal(null)} onSaved={fetchDia} />}
            {modal?.type === 'mover' && <ModalMoverSesion sesion={modal.payload} onClose={() => setModal(null)} onSaved={fetchDia} />}
            {modal?.type === 'bloqueo' && <ModalBloqueo fecha={modal.payload.fecha} horaDefault={modal.payload.hora} onClose={() => setModal(null)} onSaved={fetchDia} />}

            {cancelConfirm && <ModalCancelConfirm sesion={cancelConfirm} onConfirm={handleCancel} onCancel={() => setCancelConfirm(null)} />}
            {deleteConfirm && <ModalDeleteConfirm sesion={deleteConfirm} onConfirm={handleDelete} onCancel={() => setDeleteConfirm(null)} />}

            {menuSesionId && <div className="fixed inset-0 z-40" onClick={() => setMenuSesionId(null)} />}
        </div>
    )
}

export default Diario
