import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { logRegistro } from '../../utils/registro'
import {
    Search, Plus, Archive, Trash2, MoreVertical, X,
    ChevronLeft, ChevronRight, Edit2, Check, Loader2,
    User2, Phone, Mail, Calendar, DollarSign, Clock,
    Eye, EyeOff
} from 'lucide-react'

const DIAS = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab']
const DIAS_LABEL = { lun: 'Lunes', mar: 'Martes', mie: 'Miércoles', jue: 'Jueves', vie: 'Viernes', sab: 'Sábado' }
const HORAS = []
for (let h = 9; h <= 20; h++) HORAS.push(`${String(h).padStart(2, '0')}:00`)

function cn(...c) { return c.filter(Boolean).join(' ') }

// ─── MODAL CREAR CLIENTE ──────────────────────────────────────────────────────
const ModalCrearCliente = ({ onClose, onCreated, moduloOrigen = 'clientes' }) => {
    const { user } = useAuth()
    const [form, setForm] = useState({
        nombre: '', email: '', password: '',
        sesiones_semanales: 1,
        distribucion_semanal: ['lun'],
        hora_habitual: '10:00',
        precio_por_sesion: 0,
        fecha_inicio: '',
    })
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const toggleDia = (d) => {
        setForm(f => ({
            ...f,
            distribucion_semanal: f.distribucion_semanal.includes(d)
                ? f.distribucion_semanal.filter(x => x !== d)
                : [...f.distribucion_semanal, d]
        }))
    }

    const handleSubmit = async () => {
        if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }
        if (!form.email.trim()) { setError('El email es obligatorio'); return }
        if (!form.password || form.password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }
        if (form.distribucion_semanal.length === 0) { setError('Selecciona al menos un día'); return }
        setLoading(true)
        setError('')
        try {
            // 1. Crear usuario en Supabase Auth (el trigger on_auth_user_created
            //    sincroniza automáticamente con public.usuarios)
            const { data: authData, error: authErr } = await supabase.auth.signUp({
                email: form.email.trim(),
                password: form.password,
                options: {
                    data: { full_name: form.nombre.trim() }
                }
            })
            if (authErr) throw authErr
            const nuevoUsuarioId = authData.user?.id
            if (!nuevoUsuarioId) throw new Error('No se pudo obtener el ID del nuevo usuario')

            // 2. Crear estructura base usando el id del usuario de Auth
            const { error: eErr } = await supabase.from('clientes_estructura').insert({
                usuario_id: nuevoUsuarioId,
                sesiones_semanales: form.sesiones_semanales,
                distribucion_semanal: form.distribucion_semanal,
                hora_habitual: form.hora_habitual,
                precio_por_sesion: parseFloat(form.precio_por_sesion) || 0,
                fecha_inicio: form.fecha_inicio || null,
                estado: 'activo'
            })
            if (eErr) throw eErr

            // 3. Registro de actividad
            await logRegistro({
                accion: 'crear_cliente',
                entidad: 'cliente',
                entidad_id: nuevoUsuarioId,
                modulo_origen: moduloOrigen,
                cliente_id: nuevoUsuarioId,
                valor_nuevo: { nombre: form.nombre, email: form.email },
                autor_id: user?.id,
            })

            onCreated({ id: nuevoUsuarioId, nombre: form.nombre.trim(), email: form.email.trim() })
            onClose()
        } catch (e) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-end sm:items-center justify-center p-0 sm:p-6">
            <div className="bg-[#111318] border border-white/10 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 max-h-[90dvh] overflow-y-auto" style={{ boxShadow: '0 0 60px rgba(0,0,0,0.9)' }}>
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-black text-white">Nuevo Cliente</h3>
                    <button onClick={onClose} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors"><X className="w-5 h-5 text-white/50" /></button>
                </div>

                {error && <p className="text-red-400 text-xs mb-4 bg-red-500/10 px-3 py-2 rounded-xl">{error}</p>}

                <div className="space-y-4">
                    <div>
                        <label className="text-xs text-white/50 font-bold uppercase tracking-widest mb-1 block">Nombre *</label>
                        <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm outline-none focus:border-[#22c55e]/50 transition-colors" placeholder="Nombre completo" />
                    </div>
                    <div>
                        <label className="text-xs text-white/50 font-bold uppercase tracking-widest mb-1 block">Email *</label>
                        <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm outline-none focus:border-[#22c55e]/50 transition-colors" placeholder="email@ejemplo.com" />
                    </div>
                    <div>
                        <label className="text-xs text-white/50 font-bold uppercase tracking-widest mb-1 block">Contraseña *</label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={form.password}
                                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 pr-11 text-white text-sm outline-none focus:border-[#22c55e]/50 transition-colors"
                                placeholder="Mínimo 6 caracteres"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(v => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white/30 hover:text-white/60 transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-white/50 font-bold uppercase tracking-widest mb-1 block">Sesiones/semana</label>
                            <input type="number" min="1" max="7" value={form.sesiones_semanales} onChange={e => setForm(f => ({ ...f, sesiones_semanales: parseInt(e.target.value) || 1 }))}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm outline-none focus:border-[#22c55e]/50 transition-colors" />
                        </div>
                        <div>
                            <label className="text-xs text-white/50 font-bold uppercase tracking-widest mb-1 block">Precio/sesión (€)</label>
                            <input type="number" min="0" step="0.01" value={form.precio_por_sesion} onChange={e => setForm(f => ({ ...f, precio_por_sesion: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm outline-none focus:border-[#22c55e]/50 transition-colors" />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-white/50 font-bold uppercase tracking-widest mb-2 block">Días habituales</label>
                        <div className="flex gap-2 flex-wrap">
                            {DIAS.map(d => (
                                <button key={d} onClick={() => toggleDia(d)}
                                    className={cn('px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border',
                                        form.distribucion_semanal.includes(d)
                                            ? 'bg-[#22c55e]/20 text-[#22c55e] border-[#22c55e]/40'
                                            : 'bg-white/5 text-white/40 border-white/10 hover:border-white/20'
                                    )}>
                                    {d}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-white/50 font-bold uppercase tracking-widest mb-1 block">Hora habitual</label>
                            <select value={form.hora_habitual} onChange={e => setForm(f => ({ ...f, hora_habitual: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm outline-none focus:border-[#22c55e]/50 transition-colors">
                                {HORAS.map(h => <option key={h} value={h} className="bg-[#111318]">{h}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-white/50 font-bold uppercase tracking-widest mb-1 block">Fecha inicio</label>
                            <input type="date" value={form.fecha_inicio} onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm outline-none focus:border-[#22c55e]/50 transition-colors" />
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 mt-6">
                    <button onClick={handleSubmit} disabled={loading}
                        className="flex-1 py-4 bg-[#22c55e]/20 text-[#22c55e] rounded-2xl font-black text-sm border border-[#22c55e]/30 hover:bg-[#22c55e]/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        Crear cliente
                    </button>
                    <button onClick={onClose} className="px-6 py-4 bg-white/5 text-white/50 rounded-2xl font-black text-sm hover:bg-white/10 transition-colors">
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── FICHA CLIENTE ─────────────────────────────────────────────────────────────
const FichaCliente = ({ clienteId, onBack }) => {
    const { user } = useAuth()
    const [cliente, setCliente] = useState(null)
    const [estructura, setEstructura] = useState(null)
    const [sesiones, setSesiones] = useState([])
    const [loading, setLoading] = useState(true)
    const [editMode, setEditMode] = useState(false)
    const [editForm, setEditForm] = useState({})
    const [saveLoading, setSaveLoading] = useState(false)
    const [menuOpen, setMenuOpen] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [confirmArchive, setConfirmArchive] = useState(false)
    const [confirmOverwrite, setConfirmOverwrite] = useState(false)

    useEffect(() => {
        const load = async () => {
            setLoading(true)
            const [{ data: cli }, { data: est }, { data: ses }] = await Promise.all([
                supabase.from('usuarios').select('*').eq('id', clienteId).single(),
                supabase.from('clientes_estructura').select('*').eq('usuario_id', clienteId).single(),
                supabase.from('sesiones').select('*').eq('cliente_id', clienteId).order('fecha', { ascending: false }).limit(20)
            ])
            setCliente(cli)
            setEstructura(est)
            setSesiones(ses || [])
            if (est) setEditForm({
                sesiones_semanales: est.sesiones_semanales,
                distribucion_semanal: [...(est.distribucion_semanal || [])],
                hora_habitual: est.hora_habitual,
                precio_por_sesion: est.precio_por_sesion,
                notas: est.notas || ''
            })
            setLoading(false)
        }
        load()
    }, [clienteId])

    const handleSave = async () => {
        setSaveLoading(true)
        try {
            const { error } = await supabase.from('clientes_estructura')
                .update({ ...editForm, updated_at: new Date().toISOString() })
                .eq('usuario_id', clienteId)
            if (error) throw error
            await logRegistro({
                accion: 'editar_estructura_cliente', entidad: 'cliente', entidad_id: clienteId,
                modulo_origen: 'clientes', cliente_id: clienteId,
                valor_anterior: estructura, valor_nuevo: editForm, autor_id: user?.id
            })
            setEstructura(prev => ({ ...prev, ...editForm }))
            setEditMode(false)
        } catch (e) { alert(e.message) }
        finally { setSaveLoading(false) }
    }

    const handleArchive = async () => {
        await supabase.from('clientes_estructura').update({ estado: 'archivado' }).eq('usuario_id', clienteId)
        await logRegistro({ accion: 'archivar_cliente', entidad: 'cliente', entidad_id: clienteId, modulo_origen: 'clientes', cliente_id: clienteId, valor_anterior: { estado: 'activo' }, valor_nuevo: { estado: 'archivado' }, autor_id: user?.id })
        setConfirmArchive(false)
        onBack()
    }

    const handleDelete = async () => {
        await supabase.from('usuarios').delete().eq('id', clienteId)
        await logRegistro({ accion: 'eliminar_cliente', entidad: 'cliente', entidad_id: clienteId, modulo_origen: 'clientes', cliente_id: clienteId, autor_id: user?.id })
        setConfirmDelete(false)
        onBack()
    }

    const toggleDia = (d) => setEditForm(f => ({
        ...f,
        distribucion_semanal: f.distribucion_semanal?.includes(d)
            ? f.distribucion_semanal.filter(x => x !== d)
            : [...(f.distribucion_semanal || []), d]
    }))

    const realizadas = sesiones.filter(s => s.estado === 'realizada').length
    const pendientesPago = sesiones.filter(s => s.pago_estado === 'pendiente' && s.estado === 'realizada').length
    const totalPendiente = sesiones.filter(s => s.pago_estado === 'pendiente' && s.estado === 'realizada')
        .reduce((acc, s) => acc + (parseFloat(s.importe) || parseFloat(estructura?.precio_por_sesion) || 0), 0)

    if (loading) return (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-[#22c55e] animate-spin" /></div>
    )

    return (
        <div className="p-4 pb-8 relative">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <button onClick={onBack} className="p-2 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors">
                    <ChevronLeft className="w-5 h-5 text-white/60" />
                </button>
                <div className="flex-1">
                    <h2 className="text-xl font-black text-white">{cliente?.nombre}</h2>
                    <p className="text-white/40 text-xs">{cliente?.email}</p>
                </div>
                <div className="flex gap-2">
                    {!editMode ? (
                        <>
                            <button onClick={() => setEditMode(true)}
                                className="px-4 py-2 bg-[#22c55e]/15 text-[#22c55e] rounded-2xl font-bold text-sm border border-[#22c55e]/30 hover:bg-[#22c55e]/25 transition-colors">
                                Editar
                            </button>
                            <button onClick={() => setConfirmArchive(true)}
                                className="px-4 py-2 bg-white/5 text-white/50 rounded-2xl font-bold text-sm border border-white/10 hover:bg-white/10 transition-colors">
                                Archivar
                            </button>
                            <div className="relative">
                                <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors"><MoreVertical className="w-5 h-5 text-white/50" /></button>
                                {menuOpen && (
                                    <div className="absolute right-0 top-full mt-1 w-52 bg-[#1a1d24] border border-white/10 rounded-2xl overflow-hidden z-50 shadow-2xl">
                                        <button onClick={() => { setConfirmOverwrite(true); setMenuOpen(false) }}
                                            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white/70 hover:bg-white/5 transition-colors">
                                            Sobrescribir excepciones futuras
                                        </button>
                                        <button onClick={() => { setConfirmDelete(true); setMenuOpen(false) }}
                                            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors border-t border-white/5">
                                            <Trash2 className="w-4 h-4" /> Eliminar cliente
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            <button onClick={handleSave} disabled={saveLoading}
                                className="px-4 py-2 bg-[#22c55e]/20 text-[#22c55e] rounded-2xl font-black text-sm border border-[#22c55e]/30 hover:bg-[#22c55e]/30 transition-colors disabled:opacity-50 flex items-center gap-2">
                                {saveLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Guardar
                            </button>
                            <button onClick={() => setEditMode(false)} className="px-4 py-2 bg-white/5 text-white/50 rounded-2xl font-bold text-sm hover:bg-white/10 transition-colors">Cancelar</button>
                        </>
                    )}
                </div>
            </div>

            {/* Métricas rápidas */}
            <div className="grid grid-cols-3 gap-3 mb-6">
                {[
                    { label: 'Realizadas', value: realizadas, color: '#22c55e' },
                    { label: 'Pend. pago', value: pendientesPago, color: '#f97316' },
                    { label: 'Total pend.', value: `${totalPendiente.toFixed(0)}€`, color: '#a78bfa' },
                ].map(m => (
                    <div key={m.label} className="bg-white/5 border border-white/8 rounded-2xl p-3 text-center">
                        <p className="text-xl font-black" style={{ color: m.color }}>{m.value}</p>
                        <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider mt-0.5">{m.label}</p>
                    </div>
                ))}
            </div>

            {/* Estructura base */}
            <div className="bg-white/5 border border-white/8 rounded-2xl p-4 mb-5">
                <h3 className="text-xs text-white/40 font-black uppercase tracking-widest mb-4">Estructura base</h3>
                {!editMode ? (
                    <div className="space-y-2.5">
                        <Row icon={<Calendar className="w-4 h-4" />} label="Sesiones/semana" value={estructura?.sesiones_semanales} />
                        <Row icon={<Clock className="w-4 h-4" />} label="Días" value={(estructura?.distribucion_semanal || []).map(d => DIAS_LABEL[d] || d).join(', ')} />
                        <Row icon={<Clock className="w-4 h-4" />} label="Hora habitual" value={estructura?.hora_habitual} />
                        <Row icon={<DollarSign className="w-4 h-4" />} label="Precio/sesión" value={`${estructura?.precio_por_sesion}€`} />
                        {estructura?.notas && <Row icon={<Edit2 className="w-4 h-4" />} label="Notas" value={estructura.notas} />}
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-white/40 font-bold mb-1 block">Sesiones/semana</label>
                                <input type="number" min="1" max="7" value={editForm.sesiones_semanales}
                                    onChange={e => setEditForm(f => ({ ...f, sesiones_semanales: parseInt(e.target.value) || 1 }))}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none" />
                            </div>
                            <div>
                                <label className="text-xs text-white/40 font-bold mb-1 block">Precio/sesión (€)</label>
                                <input type="number" min="0" step="0.01" value={editForm.precio_por_sesion}
                                    onChange={e => setEditForm(f => ({ ...f, precio_por_sesion: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none" />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-white/40 font-bold mb-2 block">Días habituales</label>
                            <div className="flex gap-2 flex-wrap">
                                {DIAS.map(d => (
                                    <button key={d} onClick={() => toggleDia(d)}
                                        className={cn('px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border',
                                            editForm.distribucion_semanal?.includes(d)
                                                ? 'bg-[#22c55e]/20 text-[#22c55e] border-[#22c55e]/40'
                                                : 'bg-white/5 text-white/40 border-white/10'
                                        )}>
                                        {d}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-white/40 font-bold mb-1 block">Hora habitual</label>
                            <select value={editForm.hora_habitual} onChange={e => setEditForm(f => ({ ...f, hora_habitual: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none">
                                {HORAS.map(h => <option key={h} value={h} className="bg-[#111318]">{h}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-white/40 font-bold mb-1 block">Notas</label>
                            <textarea value={editForm.notas} onChange={e => setEditForm(f => ({ ...f, notas: e.target.value }))} rows={2}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none resize-none" />
                        </div>
                        <p className="text-amber-400/70 text-xs">⚠️ Los cambios solo afectarán a sesiones futuras.</p>
                    </div>
                )}
            </div>

            {/* Historial sesiones */}
            <div>
                <h3 className="text-xs text-white/40 font-black uppercase tracking-widest mb-3">Historial de sesiones</h3>
                {sesiones.length > 0 ? (
                    <div className="space-y-2">
                        {sesiones.map(s => (
                            <div key={s.id} className="bg-white/5 border border-white/8 rounded-2xl px-4 py-3 flex items-center gap-3">
                                <div className={cn('w-2 h-2 rounded-full shrink-0',
                                    s.estado === 'realizada' ? 'bg-[#22c55e]' : s.estado === 'cancelada' ? 'bg-red-400' : 'bg-white/30')} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-white font-bold text-sm">{s.fecha}</p>
                                    <p className="text-white/40 text-xs">{s.hora_inicio} – {s.hora_fin}</p>
                                </div>
                                <div className="text-right">
                                    <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full',
                                        s.pago_estado === 'pagado' ? 'bg-[#22c55e]/15 text-[#22c55e]' : 'bg-amber-400/15 text-amber-400'
                                    )}>{s.pago_estado === 'pagado' ? 'Pagado' : 'Pendiente'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-white/25 text-sm text-center py-8">Sin sesiones registradas aún.</p>
                )}
            </div>

            {/* Modales de confirmación */}
            {confirmArchive && <ConfirmModal
                title="¿Archivar cliente?"
                message="El cliente quedará archivado. Su historial, pagos y sesiones se conservan."
                confirmLabel="Archivar"
                confirmClass="bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30"
                onConfirm={handleArchive} onClose={() => setConfirmArchive(false)} />}

            {confirmDelete && <ConfirmModal
                title="¿Eliminar cliente?"
                message="Esta acción es irreversible. Se borrarán todos los datos del cliente."
                confirmLabel="Eliminar permanentemente"
                confirmClass="bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30"
                onConfirm={handleDelete} onClose={() => setConfirmDelete(false)} danger />}

            {confirmOverwrite && <ConfirmModal
                title="¿Sobrescribir excepciones futuras?"
                message="Las sesiones futuras modificadas manualmente serán reemplazadas por la nueva estructura base."
                confirmLabel="Sobrescribir"
                confirmClass="bg-amber-500/20 text-amber-400 border-amber-500/30"
                onConfirm={() => setConfirmOverwrite(false)} onClose={() => setConfirmOverwrite(false)} />}

            {menuOpen && <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />}
        </div>
    )
}

const Row = ({ icon, label, value }) => (
    <div className="flex items-center gap-3">
        <span className="text-white/30 shrink-0">{icon}</span>
        <span className="text-white/40 text-sm w-28 shrink-0">{label}</span>
        <span className="text-white font-bold text-sm">{value}</span>
    </div>
)

const ConfirmModal = ({ title, message, confirmLabel, confirmClass, onConfirm, onClose, danger }) => (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[300] flex items-center justify-center p-6">
        <div className="bg-[#111318] border border-white/10 w-full max-w-xs rounded-3xl p-8 text-center" style={{ boxShadow: '0 0 40px rgba(0,0,0,0.8)' }}>
            {danger && <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20"><Trash2 className="w-6 h-6 text-red-400" /></div>}
            <h3 className="text-lg font-black text-white mb-2">{title}</h3>
            <p className="text-white/40 text-sm mb-6">{message}</p>
            <div className="flex gap-3">
                <button onClick={onConfirm} className={`flex-1 py-3 rounded-2xl font-bold text-sm border transition-colors ${confirmClass}`}>{confirmLabel}</button>
                <button onClick={onClose} className="flex-1 py-3 bg-white/5 text-white/50 rounded-2xl font-bold text-sm hover:bg-white/10">Cancelar</button>
            </div>
        </div>
    </div>
)

// ─── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────────
const OwnerClientes = ({ onNavigate, initialClienteId = null }) => {
    const { user } = useAuth()
    const [clientes, setClientes] = useState([])
    const [busqueda, setBusqueda] = useState('')
    const [loading, setLoading] = useState(true)
    const [showCrear, setShowCrear] = useState(false)
    const [fichaId, setFichaId] = useState(initialClienteId)
    const [menuClienteId, setMenuClienteId] = useState(null)

    const fetchClientes = async () => {
        setLoading(true)
        const { data } = await supabase
            .from('usuarios')
            .select('*, clientes_estructura(estado, sesiones_semanales, precio_por_sesion)')
            .eq('rol', 'cliente')
            .order('nombre')
        setClientes(data || [])
        setLoading(false)
    }

    useEffect(() => { fetchClientes() }, [])

    const filtrados = clientes.filter(c =>
        c.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
        c.email?.toLowerCase().includes(busqueda.toLowerCase())
    )

    const handleArchivar = async (clienteId) => {
        await supabase.from('clientes_estructura').update({ estado: 'archivado' }).eq('usuario_id', clienteId)
        await logRegistro({ accion: 'archivar_cliente', entidad: 'cliente', entidad_id: clienteId, modulo_origen: 'clientes', cliente_id: clienteId, autor_id: user?.id })
        setMenuClienteId(null)
        fetchClientes()
    }

    if (fichaId) return <FichaCliente clienteId={fichaId} onBack={() => { setFichaId(null); fetchClientes() }} />

    return (
        <div className="p-4">
            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 relative">
                    <Search className="w-4 h-4 text-white/30 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                        value={busqueda}
                        onChange={e => setBusqueda(e.target.value)}
                        placeholder="Buscar cliente..."
                        className="w-full bg-white/5 border border-white/10 rounded-2xl pl-11 pr-4 py-3 text-white text-sm outline-none focus:border-[#22c55e]/40 transition-colors"
                    />
                </div>
                <button onClick={() => setShowCrear(true)}
                    className="flex items-center gap-2 px-4 py-3 bg-[#22c55e]/15 text-[#22c55e] rounded-2xl font-bold text-sm border border-[#22c55e]/30 hover:bg-[#22c55e]/25 transition-colors shrink-0">
                    <Plus className="w-4 h-4" /> Nuevo
                </button>
            </div>

            <p className="text-white/30 text-xs mb-4">{filtrados.length} cliente{filtrados.length !== 1 ? 's' : ''}</p>

            {loading ? (
                <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 text-[#22c55e] animate-spin" /></div>
            ) : filtrados.length > 0 ? (
                <div className="space-y-3">
                    {filtrados.map(c => {
                        const est = c.clientes_estructura?.[0]
                        const archivado = est?.estado === 'archivado'
                        return (
                            <div key={c.id}
                                className={cn('bg-white/5 border border-white/8 rounded-2xl p-4 flex items-center gap-4 relative transition-all active:scale-[0.99]',
                                    archivado ? 'opacity-50' : 'cursor-pointer hover:border-[#22c55e]/20')}
                                onClick={() => !archivado && setFichaId(c.id)}
                                style={{ boxShadow: '0 0 10px rgba(34,197,94,0.04)' }}>
                                <div className="w-10 h-10 bg-[#22c55e]/15 rounded-full flex items-center justify-center text-[#22c55e] font-black text-sm shrink-0"
                                    style={{ boxShadow: '0 0 8px rgba(34,197,94,0.3)' }}>
                                    {c.nombre?.charAt(0)?.toUpperCase() || '?'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-white text-sm truncate">{c.nombre}</p>
                                    <p className="text-white/35 text-xs truncate">{est ? `${est.sesiones_semanales} ses/sem · ${est.precio_por_sesion}€` : 'Sin estructura'}</p>
                                </div>
                                {archivado && <span className="text-xs text-white/30 font-bold bg-white/5 px-2 py-0.5 rounded-full">Archivado</span>}
                                <div className="relative">
                                    <button
                                        onClick={e => { e.stopPropagation(); setMenuClienteId(menuClienteId === c.id ? null : c.id) }}
                                        className="p-2 rounded-xl hover:bg-white/10 transition-colors">
                                        <MoreVertical className="w-4 h-4 text-white/30" />
                                    </button>
                                    {menuClienteId === c.id && (
                                        <div className="absolute right-0 top-full mt-1 w-44 bg-[#1a1d24] border border-white/10 rounded-2xl overflow-hidden z-50 shadow-2xl">
                                            <button onClick={e => { e.stopPropagation(); setFichaId(c.id); setMenuClienteId(null) }}
                                                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white/70 hover:bg-white/5 transition-colors">
                                                <User2 className="w-4 h-4" /> Ver ficha
                                            </button>
                                            {!archivado && <button onClick={e => { e.stopPropagation(); handleArchivar(c.id) }}
                                                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-amber-400 hover:bg-amber-500/10 transition-colors">
                                                <Archive className="w-4 h-4" /> Archivar
                                            </button>}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : (
                <div className="text-center py-16">
                    <User2 className="w-12 h-12 text-white/10 mx-auto mb-3" />
                    <p className="text-white/25 text-sm">{busqueda ? 'Sin resultados para esa búsqueda' : 'No hay clientes aún'}</p>
                </div>
            )}

            {showCrear && <ModalCrearCliente onClose={() => setShowCrear(false)} onCreated={() => { fetchClientes() }} />}
            {menuClienteId && <div className="fixed inset-0 z-40" onClick={() => setMenuClienteId(null)} />}
        </div>
    )
}

export { ModalCrearCliente }
export default OwnerClientes
