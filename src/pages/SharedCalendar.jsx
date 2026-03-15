import React, { useState, useEffect, useRef } from 'react'
import {
    format, addMonths, subMonths, startOfMonth, endOfMonth,
    startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth,
    isSameDay, addDays, subDays
} from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { logRegistro } from '../utils/registro'
import {
    ChevronLeft, ChevronRight, X, Edit2, Trash2,
    CheckCircle2, Loader2, Clock, AlertCircle, LogOut,
    Lock, Move, Ban, Check, User2, MoreVertical
} from 'lucide-react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { ModalSesion, ModalMoverSesion, ModalBloqueo, ModalCancelConfirm, ModalDeleteConfirm } from '../components/AdminModals'

function cn(...inputs) { return twMerge(clsx(inputs)) }

// Horas de 9:00 a 20:00 en intervalos de 30 minutos
const HORAS = []
for (let h = 9; h <= 20; h++) {
    HORAS.push(`${String(h).padStart(2, '0')}:00`)
    if (h < 20) HORAS.push(`${String(h).padStart(2, '0')}:30`)
}

const HORAS_SELECTOR = ['Modificar hora:',
    ...HORAS.map(h => h)
]

const dayAbbrs = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const SharedCalendar = ({ onNavigate }) => {
    const { user, profile, signOut } = useAuth()
    const isAdmin = profile?.rol === 'admin'

    const [currentDate, setCurrentDate] = useState(new Date())
    const [view, setView] = useState('semanal')
    
    // Unificación de datos
    const [sesiones, setSesiones] = useState([])
    const [bloqueos, setBloqueos] = useState([])
    const [config, setConfig] = useState(null)
    const [isLoadingData, setIsLoadingData] = useState(true)
    const isFetchingRef = useRef(false) 
    
    const [bookingSuccess, setBookingSuccess] = useState(false)
    const [clientes, setClientes] = useState([])
    const [selectedClientId, setSelectedClientId] = useState('')

    const LINE = '#d0d5e8'
    const BG_WHITE = '#ffffff'
    const BG_PAST  = '#e5e7eb' // Gris unificado con el de los bloqueos
    const BG_SEL   = '#fef9c3'

    // Modal de confirmación de nueva reserva (Cliente)
    const [selectedSlot, setSelectedSlot] = useState(null)
    const [showConfirmModal, setShowConfirmModal] = useState(false)
    const [bookingLoading, setBookingLoading] = useState(false)

    // Modales de Admin (Estilo Diario)
    const [adminModal, setAdminModal] = useState(null) // { type: 'sesion' | 'bloqueo' | 'mover', payload: any }
    const [cancelConfirm, setCancelConfirm] = useState(null)
    const [deleteConfirm, setDeleteConfirm] = useState(null)
    const [menuHuecoActivo, setMenuHuecoActivo] = useState(null) // Para el menú de "+ Sesión / Bloquear" en casillas vacías

    // Modal de detalle (Cliente, o Admin antes)
    const [selectedEvent, setSelectedEvent] = useState(null)
    const [showDetailModal, setShowDetailModal] = useState(false)

    // Modal modificar (Cliente)
    const [showModifyModal, setShowModifyModal] = useState(false)
    const [modFecha, setModFecha] = useState('')
    const [modHora, setModHora] = useState('')
    const [modLoading, setModLoading] = useState(false)
    const minDate = format(new Date(), 'yyyy-MM-dd')

    // Modal cancelar (Cliente)
    const [showCancelModal, setShowCancelModal] = useState(false)
    const [cancelLoading, setCancelLoading] = useState(false)

    const [isBlockMode, setIsBlockMode] = useState(false)
    const [blockSelection, setBlockSelection] = useState([]) // Array de objetos { id, type, day, hora }
    const [blockLoading, setBlockLoading] = useState(false)
    const longPressTimer = useRef(null)
    const longPressFired = useRef(false)

    // Modo Mover Cita (Móvil)
    const [movingCita, setMovingCita] = useState(null)
    const longPressCitaTimer = useRef(null)
    const longPressCitaFired = useRef(false)

    const getItemId = (type, day, hora) => {
        if (type === 'slot') return `slot_${format(day, 'yyyy-MM-dd')}_${hora}`
        if (type === 'day') return `day_${format(day, 'yyyy-MM-dd')}`
        if (type === 'hour') return `hour_${hora}`
        return ''
    }

    const toggleSelection = (type, day, hora) => {
        const id = getItemId(type, day, hora)
        setBlockSelection(prev => {
            const exists = prev.find(item => item.id === id)
            if (exists) return prev.filter(item => item.id !== id)
            return [...prev, { id, type, day, hora }]
        })
    }

    const cancelBlockMode = () => {
        setIsBlockMode(false)
        setBlockSelection([])
        longPressFired.current = false
    }

    const isSelected = (type, day, hora) => {
        if (type === 'slot') {
            // Si el hueco está seleccionado explícitamente, o su día/hora lo están
            const selfSel = blockSelection.some(item => item.id === getItemId('slot', day, hora))
            const daySel = day && blockSelection.some(item => item.id === getItemId('day', day, null))
            const hourSel = hora && blockSelection.some(item => item.id === getItemId('hour', null, hora))
            return selfSel || daySel || hourSel
        }
        return blockSelection.some(item => item.id === getItemId(type, day, hora))
    }

    const handlePointerDown = (e, type, day, hora) => {
        if (!isAdmin) return
        if (isBlockMode) return // Si está en modo bloque, la selección se hace en onClick

        longPressFired.current = false
        if (longPressTimer.current) clearTimeout(longPressTimer.current)
        longPressTimer.current = setTimeout(() => {
            longPressFired.current = true
            setIsBlockMode(true)
            setBlockSelection([{ id: getItemId(type, day, hora), type, day, hora }])
            longPressTimer.current = null
            if (navigator.vibrate) navigator.vibrate(50)
        }, 800) // Reducido a 800ms, más ágil para móviles
    }

    const handlePointerUp = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current)
            longPressTimer.current = null
        }
    }

    // Helper para agrupar props de long-press adaptados a móvil
    const getLongPressProps = (type, day, hora) => ({
        onPointerDown: (e) => handlePointerDown(e, type, day, hora),
        onTouchStart: (e) => handlePointerDown(e, type, day, hora), // Fallback para móviles antiguos
        onPointerUp: handlePointerUp,
        onPointerLeave: handlePointerUp,
        onPointerCancel: handlePointerUp, // Vital en móviles: el navegador cancela el pointer si decide que es un scroll
        onTouchEnd: handlePointerUp,
        onTouchCancel: handlePointerUp,
        onContextMenu: (e) => { if (isAdmin) e.preventDefault(); },
        style: isAdmin ? { WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' } : {}
    })

    const handleCitaPointerDown = (e, cita) => {
        const isMine = cita.cliente_id === user?.id
        if (!isAdmin && !isMine) return
        if (cita.isBlock) return // No mover bloqueos con long press

        longPressCitaFired.current = false
        if (longPressCitaTimer.current) clearTimeout(longPressCitaTimer.current)
        longPressCitaTimer.current = setTimeout(() => {
            longPressCitaFired.current = true
            setMovingCita(cita)
            longPressCitaTimer.current = null
            if (navigator.vibrate) navigator.vibrate(50)
        }, 800)
    }

    const handleCitaPointerUp = () => {
        if (longPressCitaTimer.current) {
            clearTimeout(longPressCitaTimer.current)
            longPressCitaTimer.current = null
        }
    }

    const getAppointmentLongPressProps = (cita) => {
        const isMine = cita?.cliente_id === user?.id
        if (!isAdmin && !isMine) return {}
        if (cita?.isBlock) return {}
        return {
            onPointerDown: (e) => handleCitaPointerDown(e, cita),
            onTouchStart: (e) => handleCitaPointerDown(e, cita),
            onPointerUp: handleCitaPointerUp,
            onPointerLeave: handleCitaPointerUp,
            onPointerCancel: handleCitaPointerUp,
            onTouchEnd: handleCitaPointerUp,
            onTouchCancel: handleCitaPointerUp,
            onContextMenu: (e) => { e.preventDefault(); },
            style: { WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none', touchAction: 'none' }
        }
    }

    const handleRescheduleDirect = async (cita, targetDay, targetHora) => {
        setModLoading(true) // Reutilizamos este u otro estado si quisieras spinner, aunque la barra puede ser suficiente
        try {
            const targetDateStr = format(targetDay, 'yyyy-MM-dd')
            const [h, m] = targetHora.split(':').map(Number);
            const horaFin = `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

            await runSupabaseQuery(async () => {
                const { error } = await supabase.from(cita.isBlock ? 'bloqueos' : 'sesiones')
                    .update({ fecha: targetDateStr, hora_inicio: targetHora, hora_fin: horaFin })
                    .eq('id', cita.id)
                if (error) throw error
            })

            await fetchData()
            setBookingSuccess(true)
            setTimeout(() => setBookingSuccess(false), 4000)
            setMovingCita(null) // Por si venimos del modo mover
        } catch (err) {
            alert('Error al reprogramar: ' + err.message)
        } finally {
            setModLoading(false)
        }
    }

    const handleSlotClick = (e, day, hora, isBookable, isNotEnoughTime, isSelectableForBlock, isEditable, overlappingCita, isPast) => {
        if (longPressFired.current) { longPressFired.current = false; e.preventDefault(); return; }

        if (movingCita) {
            if (isBookable) {
                handleRescheduleDirect(movingCita, day, hora)
            } else {
                setMovingCita(null) // Cancelamos si toca una caja ocupada
            }
            return;
        }

        if (isAdmin && isBlockMode) {
            if (isSelectableForBlock) toggleSelection('slot', day, hora)
        } else {
            if (overlappingCita) {
                if (isEditable || isAdmin) {
                    if (longPressCitaFired.current) { longPressCitaFired.current = false; e.preventDefault(); return; }
                    openEvent(overlappingCita);
                }
            } else {
                if (isAdmin) {
                    // Admin: Abre menú de opciones (Sesión / Bloqueo)
                    setMenuHuecoActivo({ fecha: format(day, 'yyyy-MM-dd'), hora });
                } else {
                    // Cliente
                    if (isPast) {
                        alert('No se pueden realizar reservas en horarios que ya han pasado.');
                        return;
                    }
                    if (isNotEnoughTime) {
                        alert('Se necesita al menos 1 hora disponible para reservar.')
                        return
                    }
                    if (isBookable) {
                        openSlot(day, hora);
                    }
                }
            }
        }
    }

    const handleBlockConfirm = async (action = 'block') => {
        if (!isAdmin || blockSelection.length === 0) return
        setBlockLoading(true)
        try {
            if (action === 'block') {
                const insertPromises = []

                const getHoraFin30Mins = (hStr) => {
                    const [h, m] = hStr.split(':').map(Number)
                    let nextM = m + 30; let nextH = h;
                    if (nextM >= 60) { nextM = 0; nextH++; }
                    return `${String(nextH).padStart(2, '0')}:${String(nextM).padStart(2, '0')}`
                }

                blockSelection.forEach(({ type, day, hora }) => {
                    if (type === 'slot') {
                        const horaFin = getHoraFin30Mins(hora)
                        insertPromises.push({
                            usuario_id: user.id,
                            fecha: format(day, 'yyyy-MM-dd'),
                            hora_inicio: hora,
                            hora_fin: horaFin,
                            estado: 'confirmada'
                        })
                    } else if (type === 'day') {
                        HORAS.forEach(h => {
                            const horaFin = getHoraFin30Mins(h)
                            if (!getCitaEnHora(day, h) && !isPastSlot(day, h)) {
                                insertPromises.push({
                                    usuario_id: user.id,
                                    fecha: format(day, 'yyyy-MM-dd'),
                                    hora_inicio: h,
                                    hora_fin: horaFin,
                                    estado: 'confirmada'
                                })
                            }
                        })
                    } else if (type === 'hour') {
                        const start = startOfWeek(currentDate, { weekStartsOn: 1 })
                        const days = Array.from({ length: 6 }, (_, i) => addDays(start, i))
                        const horaFin = getHoraFin30Mins(hora)

                        days.forEach(d => {
                            if (!getCitaEnHora(d, hora) && !isPastSlot(d, hora)) {
                                insertPromises.push({
                                    usuario_id: user.id,
                                    fecha: format(d, 'yyyy-MM-dd'),
                                    hora_inicio: hora,
                                    hora_fin: horaFin,
                                    estado: 'confirmada'
                                })
                            }
                        })
                    }
                })

                if (insertPromises.length > 0) {
                    const uniquePromises = Array.from(new Set(insertPromises.map(a => JSON.stringify(a)))).map(a => JSON.parse(a))
                    await runSupabaseQuery(async () => {
                        const { error } = await supabase.from('bloqueos').insert(uniquePromises.map(p => ({
                            fecha: p.fecha,
                            hora_inicio: p.hora_inicio,
                            hora_fin: p.hora_fin,
                            tipo: 'franja',
                            owner_id: user.id
                        })))
                        if (error) throw error
                    })
                    await fetchData()
                }
            } else if (action === 'unblock') {
                const idsToDelete = []

                blockSelection.forEach(({ type, day, hora }) => {
                    const cita = getCitaEnHora(day, hora);
                    if (cita) idsToDelete.push(cita.id);
                })

                const uniqueIds = Array.from(new Set(idsToDelete));
                if (uniqueIds.length > 0) {
                    await runSupabaseQuery(async () => {
                        const { error } = await supabase.from('bloqueos').delete().in('id', uniqueIds);
                        if (error) throw error;
                    });
                    await fetchData()
                }
            }

            setIsBlockMode(false)
            setBlockSelection([])
            setBookingSuccess(true)
            setTimeout(() => setBookingSuccess(false), 4000)
        } catch (err) {
            alert('Error al bloquear: ' + err.message)
        } finally {
            setBlockLoading(false)
        }
    }

    // ── Utilidad de Reconexión para prevenir "AbortError: Lock broken" de Supabase JS ──
    const runSupabaseQuery = async (queryFn, retries = 3) => {
        try {
            return await queryFn()
        } catch (err) {
            if (retries > 0 && (err.name === 'AbortError' || err.message?.includes('Lock') || err.message?.includes('Fetch'))) {
                await new Promise(r => setTimeout(r, 600)) // Espera 600ms antes de intentar de nuevo
                return runSupabaseQuery(queryFn, retries - 1)
            }
            throw err
        }
    }

    // ── Carga de datos unificada ───────────────────────────────────────────
    const fetchData = async () => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;
        setIsLoadingData(true)
        try {
            await runSupabaseQuery(async () => {
                const { data: dataS, error: errS } = await supabase
                    .from('sesiones')
                    .select('*, usuarios!sesiones_cliente_id_fkey(nombre)')
                // Cargamos TODAS las sesiones (activas y canceladas), no solo las activas
                if (errS) throw errS

                const { data: dataB, error: errB } = await supabase
                    .from('bloqueos')
                    .select('*')
                if (errB) throw errB

                setSesiones(dataS.map(c => ({ ...c, fecha: new Date(c.fecha + 'T00:00:00'), isBlock: false })))
                setBloqueos(dataB.map(b => ({ ...b, fecha: new Date(b.fecha + 'T00:00:00'), isBlock: true })))
            })
        } catch (err) {
            console.error('Error al cargar datos:', err.message)
        } finally {
            setIsLoadingData(false)
            isFetchingRef.current = false;
        }
    }

    useEffect(() => {
        fetchData()
        loadConfig()
    }, [user, currentDate])

    const loadConfig = async () => {
        const { data } = await supabase.from('configuracion').select('*').limit(1).maybeSingle()
        if (data) setConfig(data)
    }

    const isWithinLeadTime = (date, hora, type = 'cancelacion') => {
        if (!config || isAdmin) return false
        const horasLead = type === 'cancelacion' 
            ? config.ventana_cancelacion_horas 
            : config.ventana_modificacion_horas
        
        const now = new Date()
        const [h, m] = hora.split(':').map(Number)
        const targetDate = new Date(date)
        targetDate.setHours(h, m, 0, 0)
        
        const diffMs = targetDate - now
        const diffHours = diffMs / (1000 * 60 * 60)
        
        return diffHours < horasLead
    }

    useEffect(() => {
        if (isAdmin) {
            supabase.from('usuarios').select('id, nombre, email').eq('rol', 'cliente').order('nombre')
                .then(({ data }) => setClientes(data || []))
        }
    }, [isAdmin])

    // ── Reservar ──────────────────────────────────────────────────────────
    const handleReservar = async () => {
        if (!user || !selectedSlot) return

        const targetUserId = isAdmin ? selectedClientId : user.id;
        if (isAdmin && !targetUserId) {
            alert('Por favor selecciona un cliente para la reserva.')
            return
        }

        setBookingLoading(true)
        try {
            const [h, m] = selectedSlot.hora.split(':').map(Number);
            const horaFin = `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

            let finalOwnerId = isAdmin ? user.id : null;
            if (!isAdmin) {
                const { data: admins } = await supabase.from('usuarios').select('id').eq('rol', 'admin').limit(1);
                if (admins && admins.length > 0) finalOwnerId = admins[0].id;
            }

            await runSupabaseQuery(async () => {
                const payload = {
                    cliente_id: targetUserId,
                    owner_id: finalOwnerId,
                    fecha: format(selectedSlot.day, 'yyyy-MM-dd'),
                    hora_inicio: selectedSlot.hora,
                    hora_fin: horaFin,
                    estado: 'programada',
                    tipo: 'regular',
                    pago_estado: 'pendiente'
                };

                const { error } = await supabase.from('sesiones').insert([payload]);
                if (error) throw error
            })

            await fetchData()
            setShowConfirmModal(false)
            setSelectedSlot(null)
            setBookingSuccess(true)
            setTimeout(() => setBookingSuccess(false), 4000)
        } catch (err) {
            alert('Error al reservar: ' + err.message)
        } finally {
            setBookingLoading(false)
        }
    }

    // ── Modificar ─────────────────────────────────────────────────────────
    const openModify = (cita = selectedEvent) => {
        setModFecha(format(cita.fecha, 'yyyy-MM-dd'))
        setModHora(cita.hora_inicio)
        setShowDetailModal(false)
        setShowModifyModal(true)
    }

    const handleModificar = async () => {
        if (!modFecha || !modHora || !selectedEvent) return
        if (isWithinLeadTime(selectedEvent.fecha, selectedEvent.hora_inicio, 'modificacion')) {
            alert(`No se puede modificar la reserva con menos de ${config?.ventana_modificacion_horas || 24} horas de antelación.`);
            return;
        }

        setModLoading(true)
        try {
            const [h, m] = modHora.split(':').map(Number);
            const horaFin = `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

            await runSupabaseQuery(async () => {
                const { error } = await supabase.from(selectedEvent.isBlock ? 'bloqueos' : 'sesiones')
                    .update({ fecha: modFecha, hora_inicio: modHora, hora_fin: horaFin, updated_at: new Date().toISOString() })
                    .eq('id', selectedEvent.id)
                if (error) throw error

                if (!selectedEvent.isBlock) {
                    await logRegistro({
                        accion: 'modificar_sesion_cliente', entidad: 'sesion', entidad_id: selectedEvent.id,
                        modulo_origen: 'calendario_cliente', cliente_id: selectedEvent.cliente_id,
                        valor_anterior: { fecha: format(selectedEvent.fecha, 'yyyy-MM-dd'), hora: selectedEvent.hora_inicio },
                        valor_nuevo: { fecha: modFecha, hora: modHora },
                        autor_id: user?.id
                    });
                }
            })

            await fetchData()
            setShowModifyModal(false)
            setSelectedEvent(null)
            setBookingSuccess(true)
            setTimeout(() => setBookingSuccess(false), 4000)
        } catch (err) {
            alert('Error al modificar: ' + err.message)
        } finally {
            setModLoading(false)
        }
    }

    // ── Cancelar ──────────────────────────────────────────────────────────
    const openCancel = () => {
        setShowDetailModal(false)
        setShowCancelModal(true)
    }

    const handleCancelar = async () => {
        if (!selectedEvent) return
        if (isWithinLeadTime(selectedEvent.fecha, selectedEvent.hora_inicio, 'cancelacion')) {
            alert(`No se puede anular la reserva con menos de ${config?.ventana_cancelacion_horas || 24} horas de antelación.`);
            return;
        }

        setCancelLoading(true)
        try {
            await runSupabaseQuery(async () => {
                if (selectedEvent.isBlock) {
                    const { error } = await supabase.from('bloqueos').delete().eq('id', selectedEvent.id)
                    if (error) throw error
                } else {
                    const { error } = await supabase.from('sesiones')
                        .update({ estado: 'cancelada', updated_at: new Date().toISOString() })
                        .eq('id', selectedEvent.id)
                    if (error) throw error
                    
                    await logRegistro({
                        accion: 'cancelar_sesion_cliente', entidad: 'sesion', entidad_id: selectedEvent.id,
                        modulo_origen: 'calendario_cliente', cliente_id: selectedEvent.cliente_id,
                        valor_anterior: { estado: selectedEvent.estado }, valor_nuevo: { estado: 'cancelada' }, autor_id: user?.id
                    });
                }
            })
            await fetchData()
            setShowCancelModal(false)
            setSelectedEvent(null)
        } catch (err) {
            alert('Error al cancelar: ' + err.message)
        } finally {
            setCancelLoading(false)
        }
    }

    // ── Acciones de Admin en Detalle ──────────────────────────────────────
    const toggleEstadoSesion = async (e, event) => {
        e.stopPropagation();
        if (!event || event.isBlock) return;
        const nuevoEstado = event.estado === 'programada' ? 'realizada' : 'programada';
        
        try {
            await runSupabaseQuery(async () => {
                const { error } = await supabase.from('sesiones')
                    .update({ estado: nuevoEstado, updated_at: new Date().toISOString() })
                    .eq('id', event.id);
                if (error) throw error;
            });
            await logRegistro({
                accion: 'cambiar_estado_sesion', entidad: 'sesion', entidad_id: event.id,
                modulo_origen: 'calendario_admin', cliente_id: event.cliente_id,
                valor_anterior: { estado: event.estado }, valor_nuevo: { estado: nuevoEstado }, autor_id: user?.id
            });
            await fetchData();
            if (selectedEvent?.id === event.id) {
                setSelectedEvent(prev => ({ ...prev, estado: nuevoEstado }));
            }
        } catch (err) {
            alert('Error al cambiar el estado: ' + err.message);
        }
    }

    const openCancelFromAdmin = () => {
        setCancelConfirm(selectedEvent);
        setShowDetailModal(false);
    }
    
    const openDeleteFromAdmin = () => {
        setDeleteConfirm(selectedEvent);
        setShowDetailModal(false);
    }

    // ── Toggle pago_estado ──────────────────────────────────────────
    const togglePagoEstado = async (e, event) => {
        e.stopPropagation();
        if (!event || event.isBlock) return;
        const nuevoEstado = event.pago_estado === 'pagada' ? 'pendiente' : 'pagada';
        try {
            await runSupabaseQuery(async () => {
                const { error } = await supabase.from('sesiones')
                    .update({ pago_estado: nuevoEstado, updated_at: new Date().toISOString() })
                    .eq('id', event.id);
                if (error) throw error;
            });
            await logRegistro({
                accion: 'cambiar_pago_sesion', entidad: 'sesion', entidad_id: event.id,
                modulo_origen: 'calendario_admin', cliente_id: event.cliente_id,
                valor_anterior: { pago_estado: event.pago_estado }, valor_nuevo: { pago_estado: nuevoEstado }, autor_id: user?.id
            });
            await fetchData();
            setSelectedEvent(prev => prev ? ({ ...prev, pago_estado: nuevoEstado }) : null);
        } catch (err) {
            alert('Error al cambiar el estado de pago: ' + err.message);
        }
    }

    const nav = (dir) => {
        const delta = dir === 1 ? 1 : -1;
        if (view === 'mensual') {
            setCurrentDate(d => addMonths(d, delta))
        } else if (view === 'semanal') {
            setCurrentDate(d => addDays(d, 7 * delta))
        } else {
            // Navegación diaria: Si saltamos a un domingo, añadimos un día más al salto
            setCurrentDate(d => {
                let nextDay = addDays(d, delta);
                if (nextDay.getDay() === 0) { // 0 es Domingo
                    nextDay = addDays(nextDay, delta);
                }
                return nextDay;
            })
        }
    }

    const isPastSlot = (day, hora) => {
        const now = new Date()
        const [h, m] = hora.split(':').map(Number)
        const slotDate = new Date(day)
        slotDate.setHours(h, m, 0, 0)
        return slotDate < now
    }

    const isSlotBookable = (day, hora, idToIgnore = null) => {
        if (hora === '19:30') return false
        if (getCitaEnHora(day, hora, idToIgnore)) return false

        // Al ser sesiones de 1 hora, la siguiente franja de 30 min también debe estar libre
        const [h, m] = hora.split(':').map(Number)
        let nextM = m + 30
        let nextH = h
        if (nextM >= 60) {
            nextM = 0
            nextH++
        }
        const nextHora = `${String(nextH).padStart(2, '0')}:${String(nextM).padStart(2, '0')}`

        // Si no existe la siguiente franja en nuestro horario o está ocupada, no es reservable
        if (!HORAS.includes(nextHora)) return false
        if (getCitaEnHora(day, nextHora, idToIgnore)) return false

        return true
    }

    const openSlot = (day, hora) => {
        if (isPastSlot(day, hora)) return
        if (!isSlotBookable(day, hora)) return

        // Regla 24h para nuevas reservas (usamos ventana_modificacion_horas como referencia general)
        if (isWithinLeadTime(day, hora, 'modificacion')) {
            alert(`Lo sentimos, las reservas deben realizarse con al menos ${config?.ventana_modificacion_horas || 24} horas de antelación.`);
            return;
        }
        
        if (isAdmin) {
            setMenuHuecoActivo({ fecha: format(day, 'yyyy-MM-dd'), hora });
        } else {
            setSelectedSlot({ day, hora })
            setShowConfirmModal(true)
        }
    }
    
    const openEvent = (cita) => { 
        setSelectedEvent(cita); 
        // Si es admin abrir menú (o mantener el detail que será modificado)
        // Por ahora mantenemos showDetailModal para el admin también,
        // pero lo modificaremos para que muestre el menú unificado de Admin
        setShowDetailModal(true) 
    }

    const getCitaEnHora = (day, hora, idToIgnore = null) => {
        const [h, m] = hora.split(':').map(Number);
        const t = h * 60 + m;

        // Primero comprobar bloqueos completos de día
        const bloqueoCompleto = bloqueos.find(b => isSameDay(b.fecha, day) && b.tipo === 'dia_completo');
        if (bloqueoCompleto) {
            if (idToIgnore && bloqueoCompleto.id === idToIgnore) return null;
            return { ...bloqueoCompleto, hora_inicio: HORAS[0], hora_fin: '20:30' };
        }

        // Luego buscar sesion o bloqueo por franja/hueco
        const item = [...sesiones, ...bloqueos.filter(b => b.tipo !== 'dia_completo')].find(c => {
            if (idToIgnore && c.id === idToIgnore) return false;
            if (!isSameDay(c.fecha, day)) return false;
            if (!c.hora_inicio || !c.hora_fin) return false;
            const [sh, sm] = c.hora_inicio.split(':').map(Number);
            const [eh, em] = c.hora_fin.split(':').map(Number);
            const startT = sh * 60 + sm;
            const endT = eh * 60 + em;
            return t >= startT && t < endT;
        });
        
        return item || null;
    }

    const getEventSlots = (cita) => {
        if (!cita) return 2;
        if (cita.tipo === 'dia_completo') return HORAS.length;
        if (!cita.hora_inicio || !cita.hora_fin) return 2;
        const [sh, sm] = cita.hora_inicio.split(':').map(Number);
        const [eh, em] = cita.hora_fin.split(':').map(Number);
        const slots = Math.round(((eh * 60 + em) - (sh * 60 + sm)) / 30);
        return slots > 0 ? slots : 2;
    }


    // Etiqueta de la vista activa para la fecha
    const getViewLabel = () => {
        if (view === 'diaria') return format(currentDate, "d 'de' MMMM yyyy", { locale: es }).toUpperCase()
        if (view === 'semanal') {
            const start = startOfWeek(currentDate, { weekStartsOn: 1 })
            return `${format(start, 'd MMM', { locale: es })} – ${format(addDays(start, 6), 'd MMM yyyy', { locale: es })}`.toUpperCase()
        }
        return format(currentDate, 'MMMM yyyy', { locale: es }).toUpperCase()
    }

    const renderMonthly = () => {
        const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 })
        const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 })
        const days = eachDayOfInterval({ start, end })

        return (
            <div style={{ background: '#ffffff', color: '#2b47c9', width: '100%', overflow: 'hidden', boxSizing: 'border-box' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #e2e6f0' }}>
                    {['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'].map((d, i) => (
                        <div key={d} style={{
                            padding: '10px 0', textAlign: 'center', fontSize: 9, fontWeight: 800,
                            color: '#2b47c9', textTransform: 'uppercase', letterSpacing: '0.06em',
                            borderRight: '1px solid #e2e6f0',
                        }}>{d}</div>
                    ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', width: '100%' }}>
                    {days.map((day, i) => {
                        const today = isSameDay(day, new Date())
                        const isThisMonth = isSameMonth(day, currentDate)
                        return (
                            <div key={i}
                                onClick={() => { if (isAdmin) { setCurrentDate(day); setView('diaria'); } }}
                                style={{
                                    boxSizing: 'border-box',
                                    minHeight: 70, padding: 4,
                                    borderRight: '1px solid #e2e6f0',
                                    borderBottom: '1px solid #e2e6f0',
                                    opacity: isThisMonth ? 1 : 0.3,
                                    cursor: isAdmin ? 'pointer' : 'default',
                                    background: '#ffffff',
                                    minWidth: 0,
                                    overflow: 'hidden'
                                }}>
                                <span style={{
                                    fontSize: 11, fontWeight: 800,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    width: 20, height: 20, borderRadius: '50%',
                                    background: today ? '#2b47c9' : 'transparent',
                                    color: today ? '#ffffff' : '#2b47c9',
                                    margin: '0 auto'
                                }}>{format(day, 'd')}</span>
                                <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    {sesiones.filter(c => isSameDay(c.fecha, day))
                                        .filter(c => isAdmin ? true : c.cliente_id === user?.id)
                                        .filter(c => c.estado !== 'cancelada' || isAdmin)
                                        .map(c => {
                                            const isCancelled = c.estado === 'cancelada';
                                            return (
                                                <div key={c.id}
                                                    style={{
                                                        borderRadius: 4, width: '100%',
                                                        background: isCancelled ? 'rgba(43,71,201,0.2)' : '#2b47c9',
                                                        boxShadow: movingCita?.id === c.id ? '0 0 10px rgba(255,0,85,0.4)' : 'none',
                                                        padding: '1px 2px',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        cursor: 'pointer',
                                                        border: movingCita?.id === c.id ? '1.5px solid #ff0055' : isCancelled ? '1px dashed rgba(43,71,201,0.4)' : 'none',
                                                        opacity: isCancelled ? 0.55 : 1,
                                                        overflow: 'hidden'
                                                    }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (movingCita) { if (movingCita.id === c.id) setMovingCita(null); return; }
                                                        openEvent(c)
                                                    }}>
                                                    <span style={{ fontSize: 7, fontWeight: 800, color: isCancelled ? '#2b47c9' : '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {isAdmin ? (c.usuarios?.nombre || '...') : c.hora_inicio}
                                                    </span>
                                                </div>
                                            )
                                        })}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        )
    }


    const renderWeekly = () => {
        const start = startOfWeek(currentDate, { weekStartsOn: 1 })
        // Generar sólo 6 días (Lunes a Sábado)
        const days = Array.from({ length: 6 }, (_, i) => addDays(start, i))
        const dayAbbrs = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']
        const COL = '44px repeat(6, 1fr)'
        const LINE = '#d0d5e8' // color visible de las líneas de la cuadrícula
        const BG_WHITE = '#ffffff'
        // BG_PAST se hereda del scope externo (#e5e7eb) para coincidir con el color de los bloqueos
        const BG_SEL   = '#fef9c3'

        return (
            <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 150px)', width: '100%' }}>
                <div style={{ width: '100%' }}>

                    {/* ── CABECERA STICKY ── */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: COL,
                        columnGap: '1px',
                        background: LINE,     /* los gaps muestran este color = líneas */
                        position: 'sticky', top: 0, zIndex: 20,
                        borderBottom: `2px solid ${LINE}`,
                    }}>
                        {/* Celda esquina */}
                        <div style={{ background: BG_WHITE, minHeight: 44 }} />
                        {days.map((day, i) => {
                            const isToday = isSameDay(day, new Date())
                            return (
                                <div key={i}
                                    style={{
                                        background: BG_WHITE,
                                        padding: '8px 2px', textAlign: 'center',
                                        cursor: (isAdmin && isBlockMode) ? 'pointer' : 'default',
                                    }}
                                    onClick={() => { if (longPressFired.current) { longPressFired.current = false; return; } if (isAdmin && isBlockMode) toggleSelection('day', day, null); }}
                                    {...getLongPressProps('day', day, null)}>
                                    <p style={{ fontSize: 9, fontWeight: 800, color: '#2b47c9', textTransform: 'uppercase', marginBottom: 4 }}>{dayAbbrs[i]}</p>
                                    <div style={{
                                        fontSize: 12, fontWeight: 800, margin: '0 auto',
                                        width: isToday ? 24 : 'auto', height: isToday ? 24 : 'auto',
                                        borderRadius: isToday ? '50%' : 0,
                                        border: isToday ? '2px solid #2b47c9' : 'none',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: '#2b47c9',
                                    }}>
                                        {format(day, 'd')}
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* ── CUERPO: contenedor con gap vertical entre filas ── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: LINE }}>
                        {HORAS.map(hora => (
                            <div key={hora} style={{
                                display: 'grid',
                                gridTemplateColumns: COL,
                                columnGap: '1px',
                                background: LINE,    /* muestra líneas verticales */
                                height: 40,
                            }}>
                                {/* Celda hora */}
                                <div style={{
                                    background: isSelected('hour', null, hora) ? BG_SEL : BG_WHITE,
                                    display: 'flex', alignItems: 'flex-start',
                                    justifyContent: 'center', paddingTop: 4,
                                    cursor: (isAdmin && isBlockMode) ? 'pointer' : 'default',
                                }}
                                    onClick={() => { if (longPressFired.current) { longPressFired.current = false; return; } if (isAdmin && isBlockMode) toggleSelection('hour', null, hora); }}
                                    {...getLongPressProps('hour', null, hora)}>
                                    <span style={{ fontSize: 9, fontWeight: 700, color: '#2b47c9' }}>{hora}</span>
                                </div>

                                {/* Celdas de cada día */}
                                {days.map((day, i) => {
                                    const overlappingCita = getCitaEnHora(day, hora)
                                    const isStart        = overlappingCita && overlappingCita.hora_inicio === hora
                                    const isPast         = isPastSlot(day, hora)
                                    const isBookable     = (!overlappingCita || (movingCita && overlappingCita?.id === movingCita.id)) && !isPast && isSlotBookable(day, hora, movingCita?.id)
                                    const isMine         = overlappingCita && !overlappingCita.isBlock && overlappingCita.cliente_id === user?.id
                                    const isEditable     = overlappingCita && (isAdmin || isMine) && !overlappingCita.isBlock
                                    const isBlockItem    = overlappingCita?.isBlock
                                    const isSlotEmpty    = !overlappingCita && !isPast
                                    const isNotEnoughTime = isSlotEmpty && !isBookable
                                    const isSelectedSlot = isSelected('slot', day, hora)
                                    const isSelectableForBlock = (isAdmin && isBlockMode && (!overlappingCita || isPast)) || (isSlotEmpty && !isBlockMode)
                                    
                                    // Visualización gris para pasado O bloqueos
                                    const cellBg = isSelectedSlot ? BG_SEL : (isPast || isBlockItem) ? BG_PAST : BG_WHITE
                                    const cursor = (isBookable && !isWithinLeadTime(day, hora, 'modificacion')) || isPast ? 'pointer' : (isAdmin && isBlockMode) ? 'pointer' : 'default'

                                    return (
                                        <div key={i}
                                            style={{
                                                position: 'relative',
                                                background: cellBg,
                                                cursor,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                overflow: 'visible',
                                            }}
                                            onClick={(e) => {
                                                if (isAdmin && isBlockMode) {
                                                    if (!overlappingCita || isPast) toggleSelection('slot', day, hora)
                                                    return
                                                }
                                                handleSlotClick(e, day, hora, isBookable, isNotEnoughTime, true, isEditable, overlappingCita, isPast)
                                            }}
                                            {...(isAdmin && isBlockMode ? getLongPressProps('slot', day, hora) : {})}>

                                            {isStart && !isBlockItem && (
                                                <div
                                                    {...getAppointmentLongPressProps(overlappingCita)}
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        if (longPressCitaFired.current) { longPressCitaFired.current = false; e.preventDefault(); return }
                                                        if (isAdmin && isBlockMode) { if (isPastSlot(day, hora)) toggleSelection('slot', day, hora); return }
                                                        if (movingCita) { if (movingCita.id === overlappingCita.id) setMovingCita(null); return }
                                                        openEvent(overlappingCita)
                                                    }}
                                                    style={{
                                                        position: 'absolute', top: 2, left: 2, right: 2,
                                                        height: `calc(${getEventSlots(overlappingCita) * 100}% - 4px)`, borderRadius: 8,
                                                        background: overlappingCita.estado === 'cancelada' ? '#ef4444' : '#2b47c9',
                                                        border: movingCita?.id === overlappingCita.id
                                                            ? '2px solid #ff0055'
                                                            : overlappingCita.estado === 'cancelada'
                                                                ? '1.5px dashed #991b1b'
                                                                : 'none',
                                                        boxShadow: movingCita?.id === overlappingCita.id ? '0 0 10px rgba(255,0,85,0.4)' : '0 2px 4px rgba(43,71,201,0.2)',
                                                        opacity: overlappingCita.estado === 'cancelada' ? 0.9 : 1,
                                                        zIndex: 15, cursor: 'pointer',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        ...getAppointmentLongPressProps(overlappingCita).style,
                                                    }}>
                                                    {isAdmin ? (
                                                        <span style={{ fontSize: 8, fontWeight: 800, color: '#fff', textAlign: 'center', padding: '0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {overlappingCita.usuarios?.nombre || '...'}
                                                        </span>
                                                    ) : isMine ? (
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1.1 }}>
                                                            <span style={{ fontSize: 12, fontWeight: 900, color: '#fff' }}>{overlappingCita.hora_inicio}</span>
                                                            <span style={{ fontSize: 10, fontWeight: 900, color: '#fff', opacity: 0.8 }}>-</span>
                                                            <span style={{ fontSize: 12, fontWeight: 900, color: '#fff' }}>{overlappingCita.hora_fin}</span>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            )}
                                            {isStart && isBlockItem && isAdmin && (
                                                <div
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        if (isBlockMode) { toggleSelection('slot', day, hora); return; }
                                                        openEvent(overlappingCita)
                                                    }}
                                                    style={{
                                                        position: 'absolute', top: 2, left: 2, right: 2,
                                                        height: `calc(${getEventSlots(overlappingCita) * 100}% - 4px)`, borderRadius: 8,
                                                        background: '#e5e7eb', zIndex: 14, cursor: 'pointer',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                    }}>
                                                    <span style={{ fontSize: 8, fontWeight: 800, color: '#4b5563' }}>BLOQUEO</span>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        ))}
                    </div>

                </div>
            </div>
        )
    }
    const renderDaily = () => {
        // Usamos las constantes definidas al principio de SharedCalendar

        return (
            <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: LINE }}>

                    {/* ── CABECERA ── */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '44px 1fr',
                        columnGap: '1px',
                        background: LINE,
                        borderBottom: `2px solid ${LINE}`,
                    }}>
                        <div style={{ background: BG_WHITE, minHeight: 44 }} />
                        <div
                            style={{
                                background: BG_WHITE,
                                padding: '10px 16px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: (isAdmin && isBlockMode) ? 'pointer' : 'default',
                            }}
                            onClick={() => { if (longPressFired.current) { longPressFired.current = false; return; } if (isAdmin && isBlockMode) toggleSelection('day', currentDate, null); }}
                            {...getLongPressProps('day', currentDate, null)}>
                            <p style={{ fontSize: 13, fontWeight: 800, color: '#2b47c9', textTransform: 'uppercase', margin: 0 }}>
                                {format(currentDate, 'EEEE d', { locale: es }).toUpperCase()}
                            </p>
                        </div>
                    </div>

                    {/* ── CUERPO ── */}
                    {HORAS.map(hora => {
                        const overlappingCita = getCitaEnHora(currentDate, hora)
                        const isStart         = overlappingCita && overlappingCita.hora_inicio === hora
                        const isPast          = isPastSlot(currentDate, hora)
                        const isMine          = overlappingCita && !overlappingCita.isBlock && overlappingCita.cliente_id === user?.id
                        const isEditable      = overlappingCita && (isAdmin || isMine) && !overlappingCita.isBlock
                        const isBlockItem     = overlappingCita?.isBlock
                        const isBookable      = (!overlappingCita || (movingCita && overlappingCita?.id === movingCita.id)) && !isPast && isSlotBookable(currentDate, hora, movingCita?.id)
                        const isSlotEmpty     = !overlappingCita && !isPast
                        const isNotEnoughTime = isSlotEmpty && !isBookable
                        const isSelectedSlot = isSelected('slot', currentDate, hora)
                        const isSelectableForBlock = (isAdmin && isBlockMode && (!overlappingCita || isPast)) || (isSlotEmpty && !isBlockMode)
                        
                        // Visualización gris para pasado O bloqueos
                        const slotBg = isSelectedSlot ? BG_SEL : (isPast || isBlockItem) ? BG_PAST : BG_WHITE
                        const cursor = (isBookable && !isWithinLeadTime(currentDate, hora, 'modificacion')) || isPast ? 'pointer' : (isAdmin && isBlockMode) ? 'pointer' : 'default'

                        return (
                            <div key={hora} style={{
                                display: 'grid',
                                gridTemplateColumns: '44px 1fr',
                                columnGap: '1px',
                                background: LINE,
                                height: 40,
                            }}>
                                {/* Celda hora */}
                                <div style={{
                                    background: isSelected('hour', null, hora) ? BG_SEL : BG_WHITE,
                                    display: 'flex', alignItems: 'flex-start',
                                    justifyContent: 'center', paddingTop: 4,
                                    cursor: (isAdmin && isBlockMode) ? 'pointer' : 'default',
                                }}
                                    onClick={() => { if (longPressFired.current) { longPressFired.current = false; return; } if (isAdmin && isBlockMode) toggleSelection('hour', null, hora); }}
                                    {...getLongPressProps('hour', null, hora)}>
                                    <span style={{ fontSize: 9, fontWeight: 700, color: '#2b47c9' }}>{hora}</span>
                                </div>

                                {/* Celda contenido */}
                                <div style={{ position: 'relative', background: slotBg, overflow: 'visible' }}>
                                    {!overlappingCita || (!isEditable && !isBlockItem) ? (
                                        <div
                                            onClick={(e) => {
                                                if (isAdmin && isBlockMode) {
                                                    if (!overlappingCita || isPast) toggleSelection('slot', currentDate, hora);
                                                    return;
                                                }
                                                handleSlotClick(e, currentDate, hora, isBookable, isNotEnoughTime, isSelectableForBlock, isEditable, overlappingCita, isPast);
                                            }}
                                            {...(isSelectableForBlock || (isAdmin && isBlockMode && (!overlappingCita || isPast)) ? getLongPressProps('slot', currentDate, hora) : {})}
                                            style={{
                                                width: '100%', height: '100%',
                                                cursor,
                                            }}
                                        />
                                    ) : isStart && isEditable && (
                                        <div
                                            {...getAppointmentLongPressProps(overlappingCita)}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (longPressCitaFired.current) { longPressCitaFired.current = false; e.preventDefault(); return; }
                                                if (isAdmin && isBlockMode) { if (isPastSlot(currentDate, hora)) toggleSelection('slot', currentDate, hora); return; }
                                                if (movingCita) { if (movingCita.id === overlappingCita.id) setMovingCita(null); return; }
                                                openEvent(overlappingCita);
                                            }}
                                            style={{
                                                position: 'absolute', top: 2, left: 4, right: 4,
                                                height: `calc(${getEventSlots(overlappingCita) * 100}% - 4px)`, borderRadius: 8,
                                                background: overlappingCita.estado === 'cancelada' ? '#ef4444' : '#2b47c9',
                                                border: movingCita?.id === overlappingCita.id ? '2px solid #ff0055' : overlappingCita.estado === 'cancelada' ? '1.5px dashed #991b1b' : 'none',
                                                boxShadow: movingCita?.id === overlappingCita.id ? '0 0 10px rgba(255,0,85,0.4)' : '0 2px 4px rgba(43,71,201,0.2)',
                                                opacity: overlappingCita.estado === 'cancelada' ? 0.9 : 1,
                                                zIndex: 15, cursor: 'pointer',
                                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                                ...getAppointmentLongPressProps(overlappingCita).style,
                                            }}>
                                            {isAdmin ? (
                                                <span style={{ fontSize: 10, fontWeight: 800, color: '#fff' }}>{overlappingCita.usuarios?.nombre || '...'}</span>
                                            ) : isMine ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1.2 }}>
                                                    <span style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>{overlappingCita.hora_inicio}</span>
                                                    <span style={{ fontSize: 14, fontWeight: 900, color: '#fff', opacity: 0.8 }}>-</span>
                                                    <span style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>{overlappingCita.hora_fin}</span>
                                                </div>
                                            ) : null}
                                        </div>
                                    )}
                                    {isStart && isBlockItem && isAdmin && (
                                        <div
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                if (isBlockMode) { toggleSelection('slot', currentDate, hora); return; }
                                                openEvent(overlappingCita)
                                            }}
                                            style={{
                                                position: 'absolute', top: 2, left: 4, right: 4,
                                                height: `calc(${getEventSlots(overlappingCita) * 100}% - 4px)`, borderRadius: 8,
                                                background: '#e5e7eb', zIndex: 14, cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            }}>
                                            <span style={{ fontSize: 10, fontWeight: 800, color: '#4b5563' }}>BLOQUEO</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        )
    }



    return (
        <div style={{
            padding: '0',
            background: '#eef0f5',
            minHeight: '100%',
            fontFamily: "'Montserrat', sans-serif",
        }}>

            {/* Toast éxito */}
            {bookingSuccess && (
                <div style={{
                    position: 'fixed', bottom: 88, left: 16, right: 16, zIndex: 90,
                    background: '#2b47c9', color: '#fff', padding: '14px 20px',
                    borderRadius: 16, boxShadow: '0 4px 20px rgba(43,71,201,0.4)',
                    display: 'flex', alignItems: 'center', gap: 10,
                }}>
                    <CheckCircle2 size={18} />
                    <p style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>¡Cita guardada correctamente!</p>
                </div>
            )}

            {/* ── HEADER FORÇA ── */}
            {!isAdmin && (
                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    paddingTop: 24, paddingBottom: 8,
                }}>
                    {/* Fila FORÇA con icono */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 14, color: '#2b47c9' }}>✦</span>
                        <h1 style={{
                            fontSize: 28, fontWeight: 900, fontStyle: 'italic',
                            color: '#2b47c9', margin: 0, letterSpacing: '-0.02em',
                        }}>FORÇA</h1>
                    </div>
                    {/* BIENVENIDO */}
                    <p style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: '0.25em',
                        color: '#6b7a99', textTransform: 'uppercase', margin: '4px 0 2px',
                    }}>BIENVENIDO</p>
                    {/* Nombre usuario - JOS en gris, UE en azul (o nombre completo en azul) */}
                    <h2 style={{ margin: 0 }}>
                        <span style={{ fontSize: 28, fontWeight: 900, color: '#b8bfd4', letterSpacing: '-0.02em' }}>
                            {(profile?.nombre || 'USUARIO').toUpperCase().slice(0, 3)}
                        </span>
                        <span style={{ fontSize: 28, fontWeight: 900, color: '#2b47c9', letterSpacing: '-0.02em' }}>
                            {(profile?.nombre || 'USUARIO').toUpperCase().slice(3)}
                        </span>
                    </h2>
                </div>
            )}

            {/* ── TABS MENSUAL / SEMANAL / DIARIA ── */}
            <div style={{
                display: 'flex', gap: 0,
                margin: '16px 16px 12px',
                background: '#dde0ea',
                borderRadius: 24,
                padding: 3,
            }}>
                {[
                    { v: 'mensual', label: 'MENSUAL' },
                    { v: 'semanal', label: 'SEMANAL' },
                    { v: 'diaria', label: 'DIARIA' },
                ].map(({ v, label }) => (
                    <button
                        key={v}
                        onClick={() => setView(v)}
                        style={{
                            flex: 1,
                            padding: '9px 0',
                            borderRadius: 21,
                            fontWeight: 800,
                            fontSize: 11,
                            letterSpacing: '0.08em',
                            border: view === v ? '1.5px solid #2b47c9' : '1.5px solid transparent',
                            background: view === v ? '#ffffff' : 'transparent',
                            color: view === v ? '#2b47c9' : '#8a96b8',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* ── NAVEGADOR DE FECHA ── */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '4px 16px 12px',
            }}>
                <button
                    onClick={() => nav(-1)}
                    style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: '#dde0ea', border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#2b47c9',
                    }}>
                    <ChevronLeft size={20} strokeWidth={2.5} />
                </button>
                <h2 style={{
                    fontSize: 17, fontWeight: 900, color: '#2b47c9',
                    margin: 0, letterSpacing: '-0.01em',
                }}>
                    {getViewLabel()}
                </h2>
                <button
                    onClick={() => nav(1)}
                    style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: '#dde0ea', border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#2b47c9',
                    }}>
                    <ChevronRight size={20} strokeWidth={2.5} />
                </button>
            </div>

            {/* ── CUERPO DEL CALENDARIO ── */}
            <div style={{
                margin: '0 16px',
                background: '#ffffff',
                borderRadius: 16,
                overflow: 'hidden',
                boxShadow: '0 2px 16px rgba(30,50,120,0.08)',
                border: '1px solid #e2e6f0',
            }}>
                {isLoadingData ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
                        <Loader2 size={28} className="animate-spin" style={{ color: '#2b47c9' }} />
                    </div>
                ) : (
                    <div>
                        {view === 'mensual' && renderMonthly()}
                        {view === 'semanal' && renderWeekly()}
                        {view === 'diaria' && renderDaily()}
                    </div>
                )}
            </div>

            {/* ── MENÚ DE OPCIÓN RÁPIDA (EN FLUJO NORMAL, JUSTO DEBAJO) ── */}
            {movingCita && (
                <div className="mt-4 bg-[#111318] rounded-2xl border border-red-500/30 p-5 shadow-2xl animate-in slide-in-from-top-2 duration-300">
                    <div className="max-w-lg mx-auto flex flex-col gap-3">
                        <div className="flex flex-col">
                            <span className="text-red-500 font-black text-xs tracking-widest uppercase flex items-center gap-2"><div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>Opción rápida</span>
                            <span className="text-white text-xs mt-0.5">
                                Toca un hueco libre para reprogramarla o elige una acción:
                            </span>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    setSelectedEvent(movingCita);
                                    openModify(movingCita);
                                    setMovingCita(null);
                                }}
                                className="flex-1 px-2 py-3 bg-white text-black hover:bg-white/90 rounded-xl font-black text-xs transition-colors text-center truncate"
                            >
                                MODIFICAR
                            </button>
                            <button
                                onClick={() => {
                                    setSelectedEvent(movingCita);
                                    openCancel();
                                    setMovingCita(null);
                                }}
                                className="flex-1 px-2 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-xs transition-colors border border-red-500/50 text-center truncate"
                            >
                                ANULAR
                            </button>
                            <button
                                onClick={() => setMovingCita(null)}
                                className="flex-1 px-2 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-black text-xs transition-colors border border-transparent text-center truncate"
                            >
                                CANCELAR
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── BARRA MODO BLOQUEO (EN FLUJO NORMAL, JUSTO DEBAJO) ── */}
            {isBlockMode && isAdmin && (
                <div className="mt-4 bg-[#111318] border border-[#f97316]/30 p-5 rounded-2xl shadow-2xl animate-in slide-in-from-top-2 duration-300">
                    <div className="max-w-md mx-auto flex items-center justify-between gap-4">
                        <div className="flex flex-col">
                            <span className="text-[#f97316] font-black text-xs tracking-widest uppercase">Modo Selecc.</span>
                            <span className="text-white font-bold text-sm">
                                {blockSelection.length} {blockSelection.length === 1 ? 'elemento' : 'elementos'}
                            </span>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={cancelBlockMode}
                                className="px-3 py-3 rounded-xl font-black text-xs text-white/50 bg-white/5 hover:bg-white/10 transition-colors"
                            >
                                CANCELAR
                            </button>
                            <button
                                onClick={() => handleBlockConfirm('unblock')}
                                disabled={blockLoading || blockSelection.length === 0}
                                className="px-4 py-3 rounded-xl font-black text-xs text-white transition-all bg-[#4b5563] hover:bg-[#6b7280] disabled:opacity-50"
                            >
                                {blockLoading ? <Loader2 className="w-4 h-4 text-white animate-spin mx-auto" /> : 'DESBLOQUEAR'}
                            </button>
                            <button
                                onClick={() => handleBlockConfirm('block')}
                                disabled={blockLoading || blockSelection.length === 0}
                                className="px-4 py-3 rounded-xl font-black text-xs text-white transition-all shadow-lg shadow-red-500/20 disabled:opacity-50 flex items-center gap-2"
                                style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}
                            >
                                {blockLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'BLOQUEAR'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODAL: CONFIRMAR RESERVA (FORÇA) ──────────────────────────────── */}
            {showConfirmModal && selectedSlot && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70] flex items-center justify-center p-6">
                    <div className="bg-white border border-[#e2e6f0] w-full max-w-xs rounded-3xl p-7 text-center transition-all shadow-[0_10px_40px_rgba(43,71,201,0.15)] animate-in zoom-in-95 duration-200">
                        <div className="w-14 h-14 bg-[#f2f4f8] rounded-full flex items-center justify-center mx-auto mb-5 shadow-sm">
                            <CheckCircle2 className="w-7 h-7 text-[#2b47c9]" />
                        </div>
                        <h3 className="text-xl font-black text-[#2b47c9] mb-1">Confirmar reserva</h3>
                        <p className="text-[#6b7a99] font-bold text-sm mb-1 capitalize">
                            {format(selectedSlot.day, 'EEEE d MMM', { locale: es })}
                        </p>
                        <p className="text-[#2b47c9] font-black text-2xl mb-6">{selectedSlot.hora}</p>

                        {isAdmin && (
                            <div className="mb-6 text-left w-full mx-auto">
                                <label className="block text-[10px] font-black text-[#6b7a99] uppercase tracking-widest mb-1.5 ml-1">Para el cliente:</label>
                                <select
                                    className="w-full bg-[#f8f9fc] border border-[#e2e6f0] rounded-2xl px-4 py-3 text-sm text-[#2b47c9] font-bold focus:border-[#2b47c9] focus:ring-2 focus:ring-[#2b47c9]/20 outline-none transition-all appearance-none cursor-pointer"
                                    value={selectedClientId}
                                    onChange={(e) => setSelectedClientId(e.target.value)}
                                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7a99'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundPosition: 'right 1rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.2em 1.2em' }}
                                >
                                    <option value="" disabled>Seleccionar...</option>
                                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre || c.email}</option>)}
                                </select>
                            </div>
                        )}
                        <div className="flex gap-3">
                            <button
                                onClick={handleReservar}
                                disabled={bookingLoading}
                                className="flex-1 py-3.5 bg-[#2b47c9] text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-[#1e34a6] transition-colors shadow-md disabled:opacity-60"
                            >
                                {bookingLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Reservar'}
                            </button>
                            <button
                                onClick={() => { setShowConfirmModal(false); setSelectedSlot(null) }}
                                className="flex-1 py-3.5 bg-[#f2f4f8] text-[#6b7a99] rounded-2xl font-black text-sm hover:bg-[#e2e6f0] transition-colors"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}


            {/* ── MODAL: DETALLE CITA (FORÇA) ────────────────────────────────────── */}
            {showDetailModal && selectedEvent && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70] flex items-center justify-center p-6">
                    <div className="bg-white border border-[#e2e6f0] w-full max-w-xs rounded-3xl p-7 text-center transition-all shadow-[0_10px_40px_rgba(43,71,201,0.15)] animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="w-14 h-14 bg-[#f2f4f8] rounded-full flex items-center justify-center mx-auto mb-5 shadow-sm">
                            <Clock className="w-7 h-7 text-[#2b47c9]" />
                        </div>

                        <h3 className="text-xl font-black text-[#2b47c9] mb-1">
                            {selectedEvent.isBlock ? 'Detalle de Bloqueo' : 'Detalle de reserva'}
                        </h3>
                        <p className="text-[#6b7a99] text-sm mb-1 font-bold capitalize">
                            {format(selectedEvent.fecha, 'EEEE d MMMM', { locale: es })}
                        </p>
                        <p className="text-[#2b47c9] font-black text-2xl mb-6">
                            {selectedEvent.hora_inicio} - {selectedEvent.hora_fin}
                        </p>

                        {!selectedEvent.isBlock && isAdmin && (
                            <div className="mb-6 bg-[#f8f9fc] rounded-xl p-3 border border-[#e2e6f0]">
                                <p className="text-[#6b7a99] text-[10px] font-black uppercase tracking-widest mb-1">Cliente</p>
                                <p className="text-[#2b47c9] font-bold text-sm truncate">
                                    {selectedEvent.usuarios?.nombre || selectedEvent.usuarios?.email || 'Desconocido'}
                                </p>
                            </div>
                        )}

                        {isAdmin ? (
                            <div className="flex flex-col gap-2 mb-4">
                                {!selectedEvent.isBlock && (
                                    <>
                                        <button
                                            onClick={(e) => toggleEstadoSesion(e, selectedEvent)}
                                            className={cn("w-full py-3 rounded-2xl font-black text-xs transition-colors flex items-center justify-center gap-2",
                                                selectedEvent.estado === 'realizada'
                                                    ? 'bg-[#22c55e]/10 text-[#22c55e] hover:bg-[#22c55e]/20'
                                                    : selectedEvent.estado === 'cancelada'
                                                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                                        : 'bg-white border-[1.5px] border-[#e2e6f0] text-[#6b7a99] hover:bg-[#f8f9fc]'
                                            )}
                                            disabled={selectedEvent.estado === 'cancelada'}
                                        >
                                            <Check className="w-4 h-4" />
                                            {selectedEvent.estado === 'realizada' ? 'MARCADA COMO REALIZADA' : selectedEvent.estado === 'cancelada' ? 'SESIÓN CANCELADA' : 'MARCAR COMO REALIZADA'}
                                        </button>
                                        <button
                                            onClick={(e) => togglePagoEstado(e, selectedEvent)}
                                            className={cn("w-full py-3 rounded-2xl font-black text-xs transition-colors flex items-center justify-center gap-2",
                                                selectedEvent.pago_estado === 'pagada'
                                                    ? 'bg-amber-500/10 text-amber-500 border-[1.5px] border-amber-500/30 hover:bg-amber-500/20'
                                                    : 'bg-white border-[1.5px] border-[#e2e6f0] text-[#6b7a99] hover:bg-[#f8f9fc]'
                                            )}
                                            disabled={selectedEvent.estado === 'cancelada'}
                                        >
                                            {selectedEvent.pago_estado === 'pagada' ? '✓ PAGADA' : 'PENDIENTE DE PAGO'}
                                        </button>
                                        <div className="h-px bg-[#e2e6f0] my-2" />
                                    </>
                                )}
                                <button
                                    onClick={() => {
                                        if (selectedEvent.isBlock) {
                                            setAdminModal({ type: 'editar_bloqueo', payload: selectedEvent });
                                        } else {
                                            setAdminModal({ type: 'mover', payload: selectedEvent });
                                        }
                                        setShowDetailModal(false);
                                    }}
                                    className="w-full py-3 bg-white border-[1.5px] border-[#2b47c9] text-[#2b47c9] rounded-2xl font-black text-xs hover:bg-[#f2f4f8] transition-colors flex items-center justify-center gap-2"
                                >
                                    <Move className="w-4 h-4" /> {selectedEvent.isBlock ? 'Editar bloqueo' : 'Mover Reserva'}
                                </button>
                                {!selectedEvent.isBlock && selectedEvent.estado !== 'cancelada' && (
                                    <button
                                        onClick={openCancelFromAdmin}
                                        className="w-full py-3 bg-white border-[1.5px] border-[#ef4444] text-[#ef4444] rounded-2xl font-black text-xs hover:bg-[#fef2f2] transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Ban className="w-4 h-4" /> Anular sesión
                                    </button>
                                )}
                                <button
                                    onClick={openDeleteFromAdmin}
                                    className="w-full py-3 bg-white border-[1.5px] border-[#6b7a99] text-[#6b7a99] rounded-2xl font-black text-xs hover:bg-[#f8f9fc] transition-colors flex items-center justify-center gap-2 opacity-60 hover:opacity-100"
                                >
                                    <Trash2 className="w-4 h-4" /> Eliminar permanentemente
                                </button>
                                {!selectedEvent.isBlock && (
                                    <button
                                        onClick={() => {
                                            setShowDetailModal(false);
                                            if (onNavigate) onNavigate('clientes', { clienteId: selectedEvent.cliente_id });
                                        }}
                                        className="w-full py-3 bg-[#f2f4f8] text-[#2b47c9] rounded-2xl font-black text-xs hover:bg-[#e2e6f0] transition-colors flex items-center justify-center gap-2 mt-2"
                                    >
                                        <User2 className="w-4 h-4" /> Ver ficha del cliente
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3 mb-4">
                                <button
                                    onClick={() => openModify(selectedEvent)}
                                    className="w-full py-3.5 bg-white text-[#f97316] border-[1.5px] border-[#f97316] rounded-2xl font-black text-sm hover:bg-[#fff7ed] transition-colors shadow-sm"
                                >
                                    Modificar reserva
                                </button>
                                <button
                                    onClick={() => openCancel()}
                                    className="w-full py-3.5 bg-white text-[#ef4444] border-[1.5px] border-[#ef4444] rounded-2xl font-black text-sm hover:bg-[#fef2f2] transition-colors shadow-sm"
                                >
                                    Anular reserva
                                </button>
                            </div>
                        )}
                        
                        <button
                            onClick={() => setShowDetailModal(false)}
                            className="w-full py-3.5 bg-[#f2f4f8] text-[#6b7a99] rounded-2xl font-black text-sm hover:bg-[#e2e6f0] transition-colors mt-2"
                        >
                            Volver
                        </button>
                    </div>
                </div>
            )}


            {/* ── MODAL: MODIFICAR (FORÇA) ─────────────────────────────────────── */}
            {showModifyModal && selectedEvent && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
                    <div className="bg-white border border-[#e2e6f0] w-full max-w-sm rounded-[32px] p-8 shadow-[0_10px_40px_rgba(43,71,201,0.15)] animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-black text-[#2b47c9]">Reprogramar</h3>
                            <button onClick={() => setShowModifyModal(false)} className="p-2 bg-[#f2f4f8] rounded-full hover:bg-[#e2e6f0] transition-colors">
                                <X className="w-4 h-4 text-[#6b7a99]" />
                            </button>
                        </div>

                        <div className="space-y-4 mb-8">
                            <div>
                                <label className="block text-[10px] font-black text-[#6b7a99] uppercase tracking-widest mb-2">Nueva Fecha</label>
                                <input
                                    type="date"
                                    min={minDate}
                                    value={modFecha}
                                    onChange={e => setModFecha(e.target.value)}
                                    className="w-full bg-[#f8f9fc] border border-[#e2e6f0] rounded-2xl px-4 py-3 text-[#2b47c9] font-bold focus:border-[#2b47c9] focus:ring-2 focus:ring-[#2b47c9]/20 outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-[#6b7a99] uppercase tracking-widest mb-2">Nueva Hora</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {HORAS.map(h => {
                                        const isOccupied = !isSlotBookable(new Date(modFecha), h, selectedEvent.id)
                                        return (
                                            <button
                                                key={h}
                                                disabled={isOccupied}
                                                onClick={() => setModHora(h)}
                                                className={cn(
                                                    "py-3 rounded-2xl text-sm font-bold transition-all border-[1.5px]",
                                                    modHora === h
                                                        ? "bg-[#2b47c9] text-white border-[#2b47c9] shadow-md"
                                                        : isOccupied
                                                            ? "bg-[#f2f4f8] text-[#a0abbf] border-transparent cursor-not-allowed opacity-60"
                                                            : "bg-white text-[#2b47c9] border-[#e2e6f0] hover:bg-[#f8f9fc]"
                                                )}
                                            >
                                                {h}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleModificar}
                            disabled={!modFecha || !modHora || modLoading}
                            className="w-full py-4 bg-[#2b47c9] text-white rounded-2xl font-black text-sm disabled:opacity-50 flex items-center justify-center gap-2 shadow-md hover:bg-[#1e34a6] transition-colors"
                        >
                            {modLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar nueva hora'}
                        </button>
                    </div>
                </div>
            )}


            {/* ── MODAL: ANULAR (FORÇA) ─────────────────────────────────────────── */}
            {showCancelModal && selectedEvent && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[80] flex items-center justify-center p-6">
                    <div className="bg-white border border-[#e2e6f0] w-full max-w-xs rounded-3xl p-8 shadow-[0_10px_40px_rgba(43,71,201,0.15)] text-center animate-in zoom-in-95 duration-200">
                        <div className="w-16 h-16 bg-[#fef2f2] text-[#ef4444] rounded-full flex items-center justify-center mx-auto mb-5 shadow-sm">
                            <AlertCircle className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-black text-[#2b47c9] mb-2">¿Anular reserva?</h3>
                        <p className="text-[#6b7a99] font-bold text-sm mb-2 leading-relaxed">
                            {format(selectedEvent.fecha, 'd MMMM', { locale: es })} a las {selectedEvent.hora_inicio}
                        </p>
                        <p className="text-[#a0abbf] text-xs mb-8">Esta acción no se puede deshacer.</p>
                        <div className="flex gap-3">
                            <button
                                onClick={handleCancelar}
                                disabled={cancelLoading}
                                className="flex-1 py-4 bg-[#ef4444] text-white rounded-2xl font-black text-sm shadow-md flex items-center justify-center gap-2 disabled:opacity-60 hover:bg-[#dc2626] transition-colors"
                            >
                                {cancelLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sí, anular'}
                            </button>
                            <button
                                onClick={() => setShowCancelModal(false)}
                                className="flex-1 py-4 bg-[#f2f4f8] text-[#6b7a99] rounded-2xl font-black text-sm hover:bg-[#e2e6f0] transition-colors"
                            >
                                Volver
                            </button>
                        </div>
                    </div>
                </div>
            )}


            {/* ── MENÚ HUECO ACTIVO (ADMIN) ────────────────────────────────────── */}
            {menuHuecoActivo && isAdmin && (
                <div
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-end sm:items-center justify-center p-0 sm:p-6"
                    onClick={() => setMenuHuecoActivo(null)}
                >
                    <div
                        className="bg-[#111318] border border-white/10 w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6"
                        style={{ boxShadow: '0 0 60px rgba(0,0,0,0.9)' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-base font-black text-white">{menuHuecoActivo.hora}</h3>
                            <button
                                onClick={() => setMenuHuecoActivo(null)}
                                className="p-2 bg-white/5 rounded-full"
                            >
                                <X className="w-4 h-4 text-white/50" />
                            </button>
                        </div>
                        <div className="space-y-3">
                            <button
                                onClick={() => {
                                    setAdminModal({ type: 'sesion', payload: menuHuecoActivo });
                                    setMenuHuecoActivo(null);
                                }}
                                className="w-full flex items-center gap-3 p-4 bg-white/5 hover:bg-white/10 transition-colors rounded-2xl"
                            >
                                <div className="w-10 h-10 rounded-full bg-[#22c55e]/20 text-[#22c55e] flex items-center justify-center">
                                    <Edit2 className="w-5 h-5" />
                                </div>
                                <div className="text-left flex-1 border-b border-white/5 pb-1">
                                    <p className="text-white font-bold text-sm">Nueva sesión</p>
                                    <p className="text-white/40 text-xs mt-0.5">Agendar cita con cliente</p>
                                </div>
                            </button>
                            <button
                                onClick={() => {
                                    setAdminModal({ type: 'bloqueo', payload: menuHuecoActivo });
                                    setMenuHuecoActivo(null);
                                }}
                                className="w-full flex items-center gap-3 p-4 bg-white/5 hover:bg-white/10 transition-colors rounded-2xl"
                            >
                                <div className="w-10 h-10 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center">
                                    <Lock className="w-5 h-5" />
                                </div>
                                <div className="text-left flex-1 pb-1">
                                    <p className="text-white font-bold text-sm">Bloquear tiempo (Avanzado)</p>
                                    <p className="text-white/40 text-xs mt-0.5">Opciones de bloqueo mensual/días</p>
                                </div>
                            </button>
                            <button
                                onClick={async () => {
                                    setMenuHuecoActivo(null);
                                    setBlockLoading(true);
                                    try {
                                        const getHoraFin30Mins = (hStr) => {
                                            const [h, m] = hStr.split(':').map(Number)
                                            let nextM = m + 30; let nextH = h;
                                            if (nextM >= 60) { nextM = 0; nextH++; }
                                            return `${String(nextH).padStart(2, '0')}:${String(nextM).padStart(2, '0')}`
                                        }
                                        const horaFin = getHoraFin30Mins(menuHuecoActivo.hora)
                                        
                                        await runSupabaseQuery(async () => {
                                            const { error } = await supabase.from('bloqueos').insert([{
                                                fecha: menuHuecoActivo.fecha,
                                                hora_inicio: menuHuecoActivo.hora,
                                                hora_fin: horaFin,
                                                tipo: 'franja',
                                                owner_id: user.id
                                            }])
                                            if (error) throw error
                                        })
                                        await fetchData()
                                    } catch (err) {
                                        alert('Error al bloquear: ' + err.message)
                                    } finally {
                                        setBlockLoading(false)
                                    }
                                }}
                                className="w-full flex items-center gap-3 p-4 bg-white/5 hover:bg-white/10 transition-colors rounded-2xl"
                            >
                                <div className="w-10 h-10 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center">
                                    <Ban className="w-5 h-5" />
                                </div>
                                <div className="text-left flex-1 pb-1">
                                    <p className="text-white font-bold text-sm">Bloquear esta franja</p>
                                    <p className="text-white/40 text-xs mt-0.5">Bloquear rápidamente {menuHuecoActivo.hora}</p>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODALES CENTRALIZADOS (ADMIN) ────────────────────────────────── */}
            {adminModal?.type === 'sesion' && isAdmin && (
                <ModalSesion
                    horaDia={adminModal.payload}
                    clientes={clientes}
                    onClose={() => setAdminModal(null)}
                    onSaved={fetchData}
                />
            )}
            {adminModal?.type === 'bloqueo' && isAdmin && (
                <ModalBloqueo
                    fecha={adminModal.payload.fecha}
                    horaDefault={adminModal.payload.hora}
                    onClose={() => setAdminModal(null)}
                    onSaved={fetchData}
                />
            )}
            {adminModal?.type === 'editar_bloqueo' && isAdmin && (
                <ModalBloqueo
                    fecha={adminModal.payload?.fecha instanceof Date
                        ? `${adminModal.payload.fecha.getFullYear()}-${String(adminModal.payload.fecha.getMonth()+1).padStart(2,'0')}-${String(adminModal.payload.fecha.getDate()).padStart(2,'0')}`
                        : adminModal.payload?.fecha}
                    horaDefault={adminModal.payload?.hora_inicio || '09:00'}
                    horaFinDefault={adminModal.payload?.hora_fin || '20:00'}
                    tipoDefault={adminModal.payload?.tipo || 'franja'}
                    editId={adminModal.payload?.id}
                    onClose={() => setAdminModal(null)}
                    onSaved={fetchData}
                />
            )}
            {adminModal?.type === 'mover' && isAdmin && (
                <ModalMoverSesion
                    sesion={adminModal.payload}
                    onClose={() => setAdminModal(null)}
                    onSaved={fetchData}
                />
            )}

            {cancelConfirm && isAdmin && (
                <ModalCancelConfirm
                    sesion={cancelConfirm}
                    onConfirm={async (sesion) => {
                        try {
                            setCancelLoading(true);
                            await runSupabaseQuery(async () => {
                                const { error } = await supabase.from('sesiones')
                                    .update({ estado: 'cancelada' })
                                    .eq('id', sesion.id);
                                if (error) throw error;
                            });
                            await logRegistro({
                                accion: 'cancelar_sesion', entidad: 'sesion', entidad_id: sesion.id,
                                modulo_origen: 'calendario_admin', cliente_id: sesion.cliente_id,
                                valor_anterior: { estado: sesion.estado }, valor_nuevo: { estado: 'cancelada' }, autor_id: user?.id
                            });
                            await fetchData();
                            setCancelConfirm(null);
                            setShowDetailModal(false);
                            setSelectedEvent(null);
                        } catch (err) { alert('Error: ' + err.message); }
                        finally { setCancelLoading(false); }
                    }}
                    onCancel={() => setCancelConfirm(null)}
                />
            )}
            {deleteConfirm && isAdmin && (
                <ModalDeleteConfirm
                    sesion={deleteConfirm}
                    onConfirm={async (sesion) => {
                        try {
                            setCancelLoading(true);
                            await runSupabaseQuery(async () => {
                                const { error } = await supabase.from(sesion.isBlock ? 'bloqueos' : 'sesiones')
                                    .delete().eq('id', sesion.id);
                                if (error) throw error;
                            });
                            await logRegistro({
                                accion: 'eliminar_sesion', entidad: sesion.isBlock ? 'bloqueo' : 'sesion', entidad_id: sesion.id,
                                modulo_origen: 'calendario_admin', cliente_id: sesion.cliente_id, autor_id: user?.id
                            });
                            await fetchData();
                            setDeleteConfirm(null);
                            setShowDetailModal(false);
                            setSelectedEvent(null);
                        } catch (err) { alert('Error: ' + err.message); }
                        finally { setCancelLoading(false); }
                    }}
                    onCancel={() => setDeleteConfirm(null)}
                />
            )}


        </div>
    )
}

export default SharedCalendar
