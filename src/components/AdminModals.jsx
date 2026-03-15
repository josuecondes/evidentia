import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { logRegistro } from '../utils/registro'
import { Plus, X, Loader2, Move, Lock, Ban, Trash2 } from 'lucide-react'

// ─── TOKENS FORÇA LIGHT ───────────────────────────────────────────────────────
const F = {
    blue:       '#2b47c9',
    blueHov:    '#1e34a6',
    blueSoft:   '#eef1fc',
    gray:       '#5c6b8a',
    grayLine:   '#c8d0ee',
    grayBg:     '#eef0f7',
    white:      '#ffffff',
    red:        '#e53935',
    redHov:     '#c62828',
    redSoft:    '#fff0f0',
    green:      '#19a34a',
    greenSoft:  '#edfbf3',
    orange:     '#f97316',
    // Card
    cardBg:     '#f5f7ff',
    cardBorder: '#bec8e8',
    cardShadow: '0 20px 80px rgba(43,71,201,0.22), 0 4px 16px rgba(0,0,0,0.08)',
}

// ─── OVERLAY CENTRADO (idéntico en todos los modales) ─────────────────────────
const Overlay = ({ onClick, children }) => (
    <div
        onClick={onClick}
        style={{
            position: 'fixed', inset: 0,
            background: 'rgba(30,40,90,0.45)',
            backdropFilter: 'blur(6px)',
            zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
        }}
    >
        {children}
    </div>
)

// ─── CARD DEL MODAL ───────────────────────────────────────────────────────────
const Card = ({ children, onClick }) => (
    <div
        onClick={e => { e.stopPropagation(); onClick?.() }}
        style={{
            background: F.cardBg,
            border: `1.5px solid ${F.cardBorder}`,
            borderRadius: 28,
            padding: '32px 28px 28px',
            width: '100%',
            maxWidth: 380,
            boxShadow: F.cardShadow,
        }}
    >
        {children}
    </div>
)

// ─── BOTÓN CUADRADO 3D ─────────────────────────────────────────────────────────
// Aspecto: fondo de color, sombra de color más oscura abajo = efecto 3D
const Btn3D = ({
    onClick, disabled = false, loading = false,
    color = F.blue, colorHov = F.blueHov, shadowColor = 'rgba(43,71,201,0.45)',
    textColor = F.white,
    icon, label, style = {},
}) => {
    const [pressed, setPressed] = useState(false)
    const isLight = textColor !== F.white
    return (
        <button
            onClick={onClick}
            disabled={disabled || loading}
            onMouseDown={() => setPressed(true)}
            onMouseUp={() => setPressed(false)}
            onMouseLeave={() => setPressed(false)}
            style={{
                flex: 1,
                aspectRatio: '1 / 1',
                minHeight: 80,
                minWidth: 80,
                background: disabled
                    ? '#d1d5db'
                    : isLight
                        ? `linear-gradient(180deg, #ffffff 0%, ${color} 100%)`
                        : `linear-gradient(180deg, ${color}dd 0%, ${colorHov} 100%)`,
                color: disabled ? '#9ca3af' : textColor,
                border: isLight
                    ? `1.5px solid ${F.cardBorder}`
                    : `1px solid ${colorHov}`,
                borderRadius: 18,
                cursor: disabled ? 'not-allowed' : 'pointer',
                fontWeight: 900,
                fontSize: 11,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 6,
                boxShadow: pressed || disabled
                    ? 'none'
                    : isLight
                        ? `0 5px 0 #aab2cc, inset 0 1px 0 rgba(255,255,255,0.95)`
                        : `0 6px 0 ${shadowColor}, inset 0 1px 0 rgba(255,255,255,0.22)`,
                transform: pressed ? 'translateY(4px)' : 'translateY(0)',
                transition: 'transform 0.08s ease, box-shadow 0.08s ease',
                textShadow: (!isLight && !disabled) ? '0 1px 2px rgba(0,0,0,0.28)' : 'none',
                ...style,
            }}
        >
            {loading
                ? <Loader2 style={{ width: 22, height: 22 }} className="animate-spin" />
                : <>
                    {icon && <span style={{ display: 'flex' }}>{icon}</span>}
                    <span>{label}</span>
                </>
            }
        </button>
    )
}

// ─── BOTÓN VOLVER (ancho completo, fila) ──────────────────────────────────────
const BtnVolver = ({ onClick, label = 'Volver' }) => (
    <button
        onClick={onClick}
        style={{
            width: '100%',
            padding: '14px 0',
            background: '#ffffff',
            color: F.gray,
            border: `1.5px solid ${F.cardBorder}`,
            borderRadius: 16,
            fontWeight: 800,
            fontSize: 13,
            cursor: 'pointer',
            marginTop: 12,
            boxShadow: '0 3px 0 #aab2cc',
            transition: 'background 0.15s',
            letterSpacing: '0.04em',
        }}
        onMouseEnter={e => e.currentTarget.style.background = F.grayBg}
        onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
    >
        {label}
    </button>
)

// ─── LABEL DE SECCIÓN ─────────────────────────────────────────────────────────
const Label = ({ children }) => (
    <p style={{ fontSize: 10, fontWeight: 800, color: F.gray, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 6 }}>
        {children}
    </p>
)

// ─── SELECT / INPUT REUTILIZABLES ─────────────────────────────────────────────
const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    background: '#f8f9fc', border: `1.5px solid ${F.grayLine}`,
    borderRadius: 14, padding: '10px 14px',
    color: F.blue, fontWeight: 700, fontSize: 13,
    outline: 'none', appearance: 'none',
}

const HORAS = []
for (let h = 9; h <= 20; h++) {
    HORAS.push(`${String(h).padStart(2, '0')}:00`)
    if (h < 20) HORAS.push(`${String(h).padStart(2, '0')}:30`)
}

// ─── MODAL SESIÓN ──────────────────────────────────────────────────────────────
export const ModalSesion = ({ horaDia, onClose, onSaved, clientes }) => {
    const { user } = useAuth()
    const [form, setForm] = useState({
        cliente_id: '', hora_inicio: horaDia?.hora || '10:00', tipo: 'regular', notas: ''
    })
    const [loading, setLoading] = useState(false)

    const getHoraFin = (hi) => {
        const [h, m] = hi.split(':').map(Number)
        return `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    }

    const handleSave = async () => {
        if (!form.cliente_id) return
        setLoading(true)
        try {
            const { data, error } = await supabase.from('sesiones').insert({
                cliente_id: form.cliente_id,
                owner_id: user?.id,
                fecha: horaDia.fecha,
                hora_inicio: form.hora_inicio,
                hora_fin: getHoraFin(form.hora_inicio),
                tipo: form.tipo,
                notas: form.notas,
                estado: 'programada',
                pago_estado: 'pendiente'
            }).select().single()
            if (error) throw error
            await logRegistro({
                accion: 'crear_sesion', entidad: 'sesion', entidad_id: data.id,
                modulo_origen: 'diario', cliente_id: form.cliente_id,
                valor_nuevo: form, autor_id: user?.id
            })
            onSaved()
            onClose()
        } catch (e) { alert(e.message) }
        finally { setLoading(false) }
    }

    return (
        <Overlay onClick={onClose}>
            <Card>
                <p style={{ fontSize: 10, fontWeight: 800, color: F.gray, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>
                    Nueva sesión
                </p>
                <h3 style={{ fontSize: 22, fontWeight: 900, color: F.blue, marginBottom: 20 }}>
                    {horaDia?.hora}
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                    <div>
                        <Label>Cliente *</Label>
                        <select value={form.cliente_id}
                            onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value }))}
                            style={inputStyle}>
                            <option value="">Seleccionar...</option>
                            {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre || c.email}</option>)}
                        </select>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div>
                            <Label>Hora inicio</Label>
                            <select value={form.hora_inicio}
                                onChange={e => setForm(f => ({ ...f, hora_inicio: e.target.value }))}
                                style={inputStyle}>
                                {HORAS.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                        </div>
                        <div>
                            <Label>Tipo</Label>
                            <select value={form.tipo}
                                onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                                style={inputStyle}>
                                <option value="regular">Regular</option>
                                <option value="extra">Extra</option>
                                <option value="puntual">Puntual</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                    <Btn3D
                        onClick={handleSave}
                        disabled={!form.cliente_id}
                        loading={loading}
                        color={F.green}
                        colorHov="#16a34a"
                        shadowColor="rgba(34,197,94,0.35)"
                        icon={<Plus style={{ width: 20, height: 20 }} />}
                        label="Crear"
                    />
                    <Btn3D
                        onClick={onClose}
                        color={F.grayBg}
                        shadowColor="rgba(100,116,139,0.25)"
                        textColor={F.gray}
                        label="Cancelar"
                    />
                </div>
                <BtnVolver onClick={onClose} label="Cerrar" />
            </Card>
        </Overlay>
    )
}

// ─── MODAL MOVER SESIÓN ────────────────────────────────────────────────────────
export const ModalMoverSesion = ({ sesion, onClose, onSaved }) => {
    const { user } = useAuth()
    const normalizeFecha = (f) => {
        if (!f) return ''
        if (f instanceof Date) {
            const y = f.getFullYear()
            const m = String(f.getMonth() + 1).padStart(2, '0')
            const d = String(f.getDate()).padStart(2, '0')
            return `${y}-${m}-${d}`
        }
        return f
    }
    const [fecha, setFecha] = useState(normalizeFecha(sesion.fecha))
    const [hora, setHora] = useState(sesion.hora_inicio)
    const [loading, setLoading] = useState(false)

    const handleSave = async () => {
        setLoading(true)
        const [h] = hora.split(':').map(Number)
        const horaFin = `${String(h + 1).padStart(2, '0')}:${hora.split(':')[1]}`
        try {
            await supabase.from(sesion.isBlock ? 'bloqueos' : 'sesiones').update({
                fecha, hora_inicio: hora, hora_fin: horaFin, updated_at: new Date().toISOString()
            }).eq('id', sesion.id)
            await logRegistro({
                accion: 'mover_sesion', entidad: sesion.isBlock ? 'bloqueo' : 'sesion', entidad_id: sesion.id,
                modulo_origen: 'diario', cliente_id: sesion.cliente_id,
                valor_anterior: { fecha: sesion.fecha, hora_inicio: sesion.hora_inicio },
                valor_nuevo: { fecha, hora_inicio: hora }, autor_id: user?.id
            })
            onSaved()
            onClose()
        } catch (e) { alert(e.message) }
        finally { setLoading(false) }
    }

    return (
        <Overlay onClick={onClose}>
            <Card>
                <p style={{ fontSize: 10, fontWeight: 800, color: F.gray, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>
                    Reprogramar
                </p>
                <h3 style={{ fontSize: 22, fontWeight: 900, color: F.blue, marginBottom: 20 }}>
                    {sesion.isBlock ? 'Bloqueo' : 'Sesión'}
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                    <div>
                        <Label>Nueva fecha</Label>
                        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                        <Label>Nueva hora</Label>
                        <select value={hora} onChange={e => setHora(e.target.value)} style={inputStyle}>
                            {HORAS.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                    <Btn3D
                        onClick={handleSave}
                        loading={loading}
                        color="#7c3aed"
                        shadowColor="rgba(124,58,237,0.35)"
                        icon={<Move style={{ width: 20, height: 20 }} />}
                        label="Mover"
                    />
                    <Btn3D
                        onClick={onClose}
                        color={F.grayBg}
                        shadowColor="rgba(100,116,139,0.25)"
                        textColor={F.gray}
                        label="Cancelar"
                    />
                </div>
                <BtnVolver onClick={onClose} />
            </Card>
        </Overlay>
    )
}

// ─── MODAL BLOQUEO ─────────────────────────────────────────────────────────────
export const ModalBloqueo = ({ fecha, horaDefault, horaFinDefault, tipoDefault, editId, onClose, onSaved }) => {
    const { user } = useAuth()
    const [tipo, setTipo] = useState(tipoDefault || 'franja')
    const [horaInicio, setHoraInicio] = useState(horaDefault || '09:00')
    const [horaFin, setHoraFin] = useState(horaFinDefault || '20:00')
    const [loading, setLoading] = useState(false)
    const isEdit = !!editId

    const handleSave = async () => {
        setLoading(true)
        try {
            if (isEdit) {
                const { error } = await supabase.from('bloqueos').update({
                    tipo,
                    hora_inicio: tipo === 'dia_completo' ? null : horaInicio,
                    hora_fin: tipo === 'dia_completo' ? null : horaFin,
                }).eq('id', editId)
                if (error) throw error
                await logRegistro({ accion: 'editar_bloqueo', entidad: 'bloqueo', entidad_id: editId, modulo_origen: 'calendario_admin', valor_nuevo: { fecha, tipo, horaInicio, horaFin }, autor_id: user?.id })
            } else {
                const { data, error } = await supabase.from('bloqueos').insert({
                    owner_id: user?.id,
                    fecha,
                    tipo,
                    hora_inicio: tipo === 'dia_completo' ? null : horaInicio,
                    hora_fin: tipo === 'dia_completo' ? null : horaFin,
                }).select().single()
                if (error) throw error
                await logRegistro({ accion: 'crear_bloqueo', entidad: 'bloqueo', entidad_id: data.id, modulo_origen: 'diario', valor_nuevo: { fecha, tipo, horaInicio, horaFin }, autor_id: user?.id })
            }
            onSaved()
            onClose()
        } catch (e) { alert(e.message) }
        finally { setLoading(false) }
    }

    const tipos = [
        { v: 'dia_completo', label: 'Día\ncompleto' },
        { v: 'franja',       label: 'Franja\nhoraria' },
        { v: 'huecos_libres',label: 'Huecos\nlibres' },
    ]

    return (
        <Overlay onClick={onClose}>
            <Card>
                <p style={{ fontSize: 10, fontWeight: 800, color: F.gray, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>
                    {isEdit ? 'Editar bloqueo' : 'Nuevo bloqueo'}
                </p>
                <h3 style={{ fontSize: 22, fontWeight: 900, color: F.blue, marginBottom: 20 }}>
                    {fecha}
                </h3>

                {/* Selector de tipo — cuadrados 3D */}
                <div style={{ display: 'flex', gap: 10, marginBottom: tipo !== 'dia_completo' ? 16 : 24 }}>
                    {tipos.map(({ v, label }) => (
                        <button
                            key={v}
                            onClick={() => setTipo(v)}
                            style={{
                                flex: 1,
                                aspectRatio: '1 / 1',
                                minHeight: 72,
                                background: tipo === v ? '#fef2f2' : F.grayBg,
                                color: tipo === v ? F.red : F.gray,
                                border: `2px solid ${tipo === v ? F.red : F.grayLine}`,
                                borderRadius: 16,
                                fontWeight: 800, fontSize: 10,
                                whiteSpace: 'pre-line', textAlign: 'center',
                                cursor: 'pointer',
                                boxShadow: tipo === v ? `0 4px 0 ${F.redHov}` : `0 4px 0 ${F.grayLine}`,
                                transform: tipo === v ? 'translateY(0)' : 'translateY(-2px)',
                                transition: 'all 0.1s',
                            }}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {tipo !== 'dia_completo' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                        <div>
                            <Label>Hora inicio</Label>
                            <select value={horaInicio} onChange={e => setHoraInicio(e.target.value)} style={inputStyle}>
                                {HORAS.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                        </div>
                        <div>
                            <Label>Hora fin</Label>
                            <select value={horaFin} onChange={e => setHoraFin(e.target.value)} style={inputStyle}>
                                {HORAS.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                        </div>
                    </div>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                    <Btn3D
                        onClick={handleSave}
                        loading={loading}
                        color={F.red}
                        colorHov={F.redHov}
                        shadowColor="rgba(239,68,68,0.35)"
                        icon={<Lock style={{ width: 20, height: 20 }} />}
                        label={isEdit ? 'Guardar' : 'Bloquear'}
                    />
                    <Btn3D
                        onClick={onClose}
                        color={F.grayBg}
                        shadowColor="rgba(100,116,139,0.25)"
                        textColor={F.gray}
                        label="Cancelar"
                    />
                </div>
                <BtnVolver onClick={onClose} />
            </Card>
        </Overlay>
    )
}

// ─── MODAL CANCELAR CONFIRMACIÓN ─────────────────────────────────────────────
export const ModalCancelConfirm = ({ sesion, onConfirm, onCancel }) => (
    <Overlay onClick={onCancel}>
        <Card>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{
                    width: 64, height: 64,
                    background: F.redSoft, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 12px',
                }}>
                    <Ban style={{ width: 28, height: 28, color: F.red }} />
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 900, color: F.blue, marginBottom: 6 }}>¿Cancelar sesión?</h3>
                <p style={{ fontSize: 13, color: F.gray, fontWeight: 600 }}>
                    La sesión quedará marcada como cancelada.
                </p>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
                <Btn3D
                    onClick={() => onConfirm(sesion)}
                    color={F.red}
                    shadowColor="rgba(239,68,68,0.35)"
                    icon={<Ban style={{ width: 20, height: 20 }} />}
                    label="Cancelar sesión"
                />
                <Btn3D
                    onClick={onCancel}
                    color={F.grayBg}
                    shadowColor="rgba(100,116,139,0.25)"
                    textColor={F.gray}
                    label="No"
                />
            </div>
            <BtnVolver onClick={onCancel} />
        </Card>
    </Overlay>
)

// ─── MODAL ELIMINAR CONFIRMACIÓN ─────────────────────────────────────────────
export const ModalDeleteConfirm = ({ sesion, onConfirm, onCancel }) => (
    <Overlay onClick={onCancel}>
        <Card>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{
                    width: 64, height: 64,
                    background: F.redSoft, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 12px',
                }}>
                    <Trash2 style={{ width: 28, height: 28, color: F.red }} />
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 900, color: F.blue, marginBottom: 6 }}>
                    ¿Eliminar {sesion?.isBlock ? 'bloqueo' : 'sesión'}?
                </h3>
                <p style={{ fontSize: 13, color: F.gray, fontWeight: 600 }}>
                    Esta acción no puede deshacerse.
                </p>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
                <Btn3D
                    onClick={() => onConfirm(sesion)}
                    color={F.red}
                    shadowColor="rgba(239,68,68,0.35)"
                    icon={<Trash2 style={{ width: 20, height: 20 }} />}
                    label="Eliminar"
                />
                <Btn3D
                    onClick={onCancel}
                    color={F.grayBg}
                    shadowColor="rgba(100,116,139,0.25)"
                    textColor={F.gray}
                    label="No"
                />
            </div>
            <BtnVolver onClick={onCancel} />
        </Card>
    </Overlay>
)
