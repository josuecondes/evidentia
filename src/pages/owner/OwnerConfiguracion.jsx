import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { logRegistro } from '../../utils/registro'
import { Save, X, Check, Loader2, Clock, Shield, Move, ToggleLeft, ToggleRight } from 'lucide-react'

function cn(...c) { return c.filter(Boolean).join(' ') }

const OwnerConfiguracion = () => {
    const { user } = useAuth()
    const [config, setConfig] = useState(null)
    const [form, setForm] = useState({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [editingBlock, setEditingBlock] = useState(null) // 'horario' | 'reglas' | 'movimiento'

    useEffect(() => {
        const load = async () => {
            let { data } = await supabase.from('configuracion').select('*').limit(1).maybeSingle()
            if (!data && user) {
                const { data: newData } = await supabase.from('configuracion')
                    .insert({ owner_id: user.id })
                    .select().single()
                data = newData
            }
            if (data) { setConfig(data); setForm(data) }
            setLoading(false)
        }
        load()
    }, [user])

    const handleSave = async (bloque) => {
        setSaving(true)
        try {
            const camposBloque = {
                horario: ['hora_inicio', 'hora_fin', 'dias_laborables', 'duracion_sesion_minutos'],
                reglas: ['ventana_cancelacion_horas', 'ventana_modificacion_horas', 'sesion_extra_permitida'],
                movimiento: ['periodo_movimiento_dias'],
            }
            const campos = camposBloque[bloque] || []
            const update = {}
            campos.forEach(k => update[k] = form[k])
            update.updated_at = new Date().toISOString()

            const { error } = await supabase.from('configuracion').update(update).eq('id', config.id)
            if (error) throw error

            await logRegistro({
                accion: 'cambiar_configuracion', entidad: 'configuracion', entidad_id: config.id,
                modulo_origen: 'configuracion', valor_anterior: config, valor_nuevo: update,
                autor_id: user?.id
            })
            setConfig(prev => ({ ...prev, ...update }))
            setEditingBlock(null)
        } catch (e) { alert(e.message) }
        finally { setSaving(false) }
    }

    const handleCancel = (bloque) => {
        setForm(config)
        setEditingBlock(null)
    }

    const DIAS_OPTS = [
        { key: 'lun', label: 'L' }, { key: 'mar', label: 'M' }, { key: 'mie', label: 'X' },
        { key: 'jue', label: 'J' }, { key: 'vie', label: 'V' }, { key: 'sab', label: 'S' }
    ]

    const toggleDiaLaboral = (d) => {
        setForm(f => ({
            ...f,
            dias_laborables: f.dias_laborables?.includes(d)
                ? f.dias_laborables.filter(x => x !== d)
                : [...(f.dias_laborables || []), d]
        }))
    }

    if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 text-[#22c55e] animate-spin" /></div>
    if (!config) return (
        <div className="p-6 text-center">
            <p className="text-white/40 text-sm">No se encontró configuración. Ejecuta el SQL de migración en Supabase.</p>
        </div>
    )

    return (
        <div className="p-4 space-y-4">
            {/* Bloque: Horario */}
            <ConfigBloque
                title="Horario de trabajo"
                icon={<Clock className="w-5 h-5" />}
                color="#22c55e"
                isEditing={editingBlock === 'horario'}
                onEdit={() => setEditingBlock('horario')}
                onSave={() => handleSave('horario')}
                onCancel={() => handleCancel('horario')}
                saving={saving}>
                {editingBlock === 'horario' ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-white/40 font-bold mb-1 block">Hora inicio</label>
                                <select value={form.hora_inicio} onChange={e => setForm(f => ({ ...f, hora_inicio: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none">
                                    {Array.from({ length: 13 }, (_, i) => `${String(i + 7).padStart(2, '0')}:00`).map(h =>
                                        <option key={h} value={h} className="bg-[#111318]">{h}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-white/40 font-bold mb-1 block">Hora fin</label>
                                <select value={form.hora_fin} onChange={e => setForm(f => ({ ...f, hora_fin: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none">
                                    {Array.from({ length: 15 }, (_, i) => `${String(i + 9).padStart(2, '0')}:00`).map(h =>
                                        <option key={h} value={h} className="bg-[#111318]">{h}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-white/40 font-bold mb-2 block">Días laborables</label>
                            <div className="flex gap-2">
                                {DIAS_OPTS.map(d => (
                                    <button key={d.key} onClick={() => toggleDiaLaboral(d.key)}
                                        className={cn('w-9 h-9 rounded-xl text-xs font-black border transition-all',
                                            form.dias_laborables?.includes(d.key)
                                                ? 'bg-[#22c55e]/20 text-[#22c55e] border-[#22c55e]/40'
                                                : 'bg-white/5 text-white/30 border-white/10')}>
                                        {d.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-white/40 font-bold mb-1 block">Duración sesión (min)</label>
                            <select value={form.duracion_sesion_minutos} onChange={e => setForm(f => ({ ...f, duracion_sesion_minutos: parseInt(e.target.value) }))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none">
                                {[30, 45, 60, 90, 120].map(m => <option key={m} value={m} className="bg-[#111318]">{m} minutos</option>)}
                            </select>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2 text-sm">
                        <InfoRow label="Horario" value={`${config.hora_inicio} – ${config.hora_fin}`} />
                        <InfoRow label="Días" value={(config.dias_laborables || []).join(', ')} />
                        <InfoRow label="Duración sesión" value={`${config.duracion_sesion_minutos} min`} />
                    </div>
                )}
            </ConfigBloque>

            {/* Bloque: Reglas de cancelación */}
            <ConfigBloque
                title="Reglas de cancelación"
                icon={<Shield className="w-5 h-5" />}
                color="#f97316"
                isEditing={editingBlock === 'reglas'}
                onEdit={() => setEditingBlock('reglas')}
                onSave={() => handleSave('reglas')}
                onCancel={() => handleCancel('reglas')}
                saving={saving}>
                {editingBlock === 'reglas' ? (
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs text-white/40 font-bold mb-1 block">Ventana cancelación (horas previas)</label>
                            <select value={form.ventana_cancelacion_horas} onChange={e => setForm(f => ({ ...f, ventana_cancelacion_horas: parseInt(e.target.value) }))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none">
                                {[2, 4, 6, 12, 24, 48, 72].map(h => <option key={h} value={h} className="bg-[#111318]">{h} horas antes</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-white/40 font-bold mb-1 block">Ventana modificación (horas previas)</label>
                            <select value={form.ventana_modificacion_horas} onChange={e => setForm(f => ({ ...f, ventana_modificacion_horas: parseInt(e.target.value) }))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none">
                                {[2, 4, 6, 12, 24, 48, 72].map(h => <option key={h} value={h} className="bg-[#111318]">{h} horas antes</option>)}
                            </select>
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-white font-bold text-sm">Sesión extra permitida</p>
                                <p className="text-white/35 text-xs">El cliente puede solicitar sesiones extra</p>
                            </div>
                            <button onClick={() => setForm(f => ({ ...f, sesion_extra_permitida: !f.sesion_extra_permitida }))}
                                className="transition-colors">
                                {form.sesion_extra_permitida
                                    ? <ToggleRight className="w-8 h-8 text-[#22c55e]" />
                                    : <ToggleLeft className="w-8 h-8 text-white/30" />}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2 text-sm">
                        <InfoRow label="Cancelación" value={`${config.ventana_cancelacion_horas}h antes`} />
                        <InfoRow label="Modificación" value={`${config.ventana_modificacion_horas}h antes`} />
                        <InfoRow label="Sesión extra" value={config.sesion_extra_permitida ? 'Permitida' : 'No permitida'} />
                    </div>
                )}
            </ConfigBloque>

            {/* Bloque: Movimiento */}
            <ConfigBloque
                title="Reglas de movimiento"
                icon={<Move className="w-5 h-5" />}
                color="#a78bfa"
                isEditing={editingBlock === 'movimiento'}
                onEdit={() => setEditingBlock('movimiento')}
                onSave={() => handleSave('movimiento')}
                onCancel={() => handleCancel('movimiento')}
                saving={saving}>
                {editingBlock === 'movimiento' ? (
                    <div>
                        <label className="text-xs text-white/40 font-bold mb-1 block">Periodo de movimiento (días)</label>
                        <select value={form.periodo_movimiento_dias} onChange={e => setForm(f => ({ ...f, periodo_movimiento_dias: parseInt(e.target.value) }))}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none">
                            {[1, 3, 7, 14, 30].map(d => <option key={d} value={d} className="bg-[#111318]">Dentro de {d} días</option>)}
                        </select>
                    </div>
                ) : (
                    <InfoRow label="Ventana movimiento" value={`Dentro de ${config.periodo_movimiento_dias} días`} />
                )}
            </ConfigBloque>
        </div>
    )
}

const ConfigBloque = ({ title, icon, color, isEditing, onEdit, onSave, onCancel, saving, children }) => (
    <div className="bg-white/5 border border-white/8 rounded-2xl overflow-hidden" style={{ boxShadow: `0 0 15px ${color}08` }}>
        <div className="flex items-center gap-3 p-4 border-b border-white/5">
            <span style={{ color }}>{icon}</span>
            <h3 className="text-white font-black text-sm flex-1">{title}</h3>
            {!isEditing && (
                <button onClick={onEdit} className="px-3 py-1.5 bg-white/5 text-white/50 rounded-xl text-xs font-bold hover:bg-white/10 transition-colors border border-white/8">
                    Editar
                </button>
            )}
        </div>
        <div className="p-4">
            {children}
            {isEditing && (
                <div className="flex gap-3 mt-4 pt-4 border-t border-white/5">
                    <button onClick={onSave} disabled={saving}
                        className="flex items-center gap-2 px-4 py-2.5 bg-[#22c55e]/15 text-[#22c55e] rounded-xl text-sm font-black border border-[#22c55e]/30 hover:bg-[#22c55e]/25 transition-colors disabled:opacity-50">
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Guardar
                    </button>
                    <button onClick={onCancel} className="px-4 py-2.5 bg-white/5 text-white/50 rounded-xl text-sm font-bold hover:bg-white/10 transition-colors">
                        Cancelar
                    </button>
                </div>
            )}
        </div>
    </div>
)

const InfoRow = ({ label, value }) => (
    <div className="flex justify-between items-center">
        <span className="text-white/40">{label}</span>
        <span className="text-white font-bold">{value}</span>
    </div>
)

export default OwnerConfiguracion
