// ============================================================
// POS - LOGIC & HOOKS
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { C, type CartItem, type CajaActiva, type VentaFront, type ModalType, type MetodoPago } from './types';
import type { ApiError } from '../../types/api';
import type { ChangeEvent, KeyboardEvent, FocusEvent } from 'react';

// ============================================================
// HOOKS PERSONALIZADOS
// ============================================================

interface UseBarcodeScannerProps {
  onScan: (codigo: string) => void;
  enabled?: boolean;
}

export function useBarcodeScanner({ onScan, enabled = true }: UseBarcodeScannerProps) {
  const [scanning, setScanning] = useState(false);
  const bufferRef = useRef('');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      // Ignorar si el foco está en un input numérico (monto recibido)
      if (e.target instanceof HTMLInputElement && e.target.type === 'number') return;

      if (e.key === 'Enter') {
        if (bufferRef.current.length >= 4) {
          setScanning(true);
          onScan(bufferRef.current);
          setTimeout(() => setScanning(false), 400);
        }
        bufferRef.current = '';
      } else if (e.key.length === 1) {
        bufferRef.current += e.key;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => { bufferRef.current = ''; }, 150);
      }
    };

    const listener = onKeyDown as unknown as EventListener;
    window.addEventListener('keydown', listener);
    return () => { window.removeEventListener('keydown', listener); if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [onScan, enabled]);

  return { scanning };
}

interface UseDebouncedSearchProps {
  query: string;
  minLength?: number;
  delay?: number;
  onSearch: (query: string) => Promise<void>;
}

export function useDebouncedSearch({ query, minLength = 2, delay = 300, onSearch }: UseDebouncedSearchProps) {
  useEffect(() => {
    if (query.trim().length < minLength) return;

    const timeout = setTimeout(async () => {
      try {
        await onSearch(query.trim());
      } catch (e) {
        console.error('Error en búsqueda:', e);
      }
    }, delay);

    return () => clearTimeout(timeout);
  }, [query, minLength, delay, onSearch]);
}

interface UseFlashEffectProps {
  triggerId: number | null;
  duration?: number;
}

export function useFlashEffect({ triggerId, duration = 600 }: UseFlashEffectProps) {
  const [flashId, setFlashId] = useState<number | null>(null);

  useEffect(() => {
    if (triggerId) {
      setFlashId(triggerId);
      const timeout = setTimeout(() => setFlashId(null), duration);
      return () => clearTimeout(timeout);
    }
  }, [triggerId, duration]);

  return { flashId, setFlashId };
}

// ============================================================
// LÓGICA PRINCIPAL DEL POS
// ============================================================

interface UsePOSLogicProps {
  onError?: (msg: string) => void;
}

// ── Error de API ─────────────────────────────────────────────
//
// `api` lanza el body parseado, NO una `Error`: `message` nunca se puebla y
// el status HTTP no llega a este modulo. Por eso todo catch estrecha aca en
// lugar de leer `message`.
//
// Solo se verifica `error`, el campo discriminante: es el único que las rutas
// de caja garantizan. `GET /caja/activa` responde 404 con
// `{ error: 'No hay una caja abierta' }` y sin `code`, así que `code` queda
// como campo declarado y nunca leído.
const isApiError = (e: unknown): e is ApiError =>
  typeof e === 'object' && e !== null && 'error' in e && typeof e.error === 'string';

// Mensaje exacto del 404 de `GET /caja/activa`. Como el cliente descarta el
// status, esa respuesta es indistinguible de un 500 salvo por el texto.
const NO_CAJA_ABIERTA_API_MSG = 'No hay una caja abierta';

// Copy de cara al usuario. Único dueño: el fetch lo deja como estado y
// `confirmarCobro` levanta el mismo texto, así que ambas rutas dicen lo mismo.
const NO_CAJA_ABIERTA_MSG = 'No hay una caja abierta. Abrí caja para poder cobrar.';

export function usePOSLogic({ onError }: UsePOSLogicProps = {}) {
  const { usuario } = useAuth();
  const searchRef = useRef<HTMLInputElement>(null);

  // Estado
  const [carrito, setCarrito] = useState<CartItem[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [productosFiltrados, setProductosFiltrados] = useState<CartItem[]>([]);
  const [frecuentes, setFrecuentes] = useState<CartItem[]>([]);
  const [descuento, setDescuento] = useState(0);
  const [modal, setModal] = useState<ModalType>(null);
  const [ventaExitosa, setVentaExitosa] = useState<VentaFront | null>(null);
  const [error, setError] = useState('');
  const [cajaActivaId, setCajaActivaId] = useState<number | null>(null);
  const [cajaActivaMsg, setCajaActivaMsg] = useState('');

  // Flash effect
  const [flashId, setFlashId] = useState<number | null>(null);
  const triggerFlash = (id: number) => {
    setFlashId(id);
    setTimeout(() => setFlashId(null), 600);
  };

  // Computed
  const subtotal = carrito.reduce((acc, i) => acc + i.precio * i.cantidad, 0);
  const total = Math.max(0, subtotal - descuento);

  // ── Buscar producto por código ─────────────────────────────
  const buscarPorCodigo = useCallback(async (codigo: string) => {
    try {
      const prod = await api.get<CartItem>(`/productos/barras/${codigo.trim()}`);
      agregarAlCarrito(prod);
      setBusqueda('');
      setError('');
    } catch {
      setError(`Código "${codigo}" no encontrado`);
      setTimeout(() => setError(''), 2500);
    }
  }, []);

  // Barcode scanner
  useBarcodeScanner({ onScan: buscarPorCodigo });

  // ── Agregar al carrito ─────────────────────────────────────
  const agregarAlCarrito = (prod: CartItem) => {
    setCarrito(prev => {
      const existe = prev.find(i => i.id === prod.id);
      if (existe) {
        setFlashId(prod.id);
        return prev.map(i => i.id === prod.id ? { ...i, cantidad: i.cantidad + 1 } : i);
      }
      return [...prev, { ...prod, cantidad: 1 }];
    });
  };

  const cambiarCantidad = (id: number, delta: number) => {
    setCarrito(prev =>
      prev.map(i => i.id === id ? { ...i, cantidad: Math.max(1, i.cantidad + delta) } : i)
    );
  };

  const quitarItem = (id: number) => setCarrito(prev => prev.filter(i => i.id !== id));

  // ── Búsqueda manual ────────────────────────────────────────
  const doSearch = useCallback(async (q: string) => {
    try {
      const data = await api.get<{ data: CartItem[] }>(`/productos?busqueda=${encodeURIComponent(q)}`);
      setProductosFiltrados(data.data?.slice(0, 6) || []);
    } catch (e) {
      console.error('Error al buscar productos', e);
    }
  }, []);

  useDebouncedSearch({ query: busqueda, onSearch: doSearch });

  // ── Cargar frecuentes ──────────────────────────────────────
  useEffect(() => {
    const fetchFrecuentes = async () => {
      try {
        const data = await api.get<{ data: CartItem[] }>('/productos');
        setFrecuentes(data.data?.slice(0, 6) || []);
      } catch (e) {
        console.error('Error cargando frecuentes', e);
      }
    };
    fetchFrecuentes();
  }, []);

  // ── Resolver caja activa ───────────────────────────────────
  // El POS necesita un id de caja real antes de cobrar. Antes caía al
  // hardcode '1' cuando la sesión no traía `cajaId`, y esa caja podía no
  // existir o estar cerrada.
  useEffect(() => {
    const fetchCajaActiva = async () => {
      const sinCaja = () => {
        setCajaActivaId(null);
        setCajaActivaMsg(NO_CAJA_ABIERTA_MSG);
      };

      try {
        const caja = await api.get<CajaActiva>('/caja/activa');
        const id = caja?.id;
        // Un id ausente o no numérico se trata igual que un 404: no hay caja
        // con la que cobrar, y el payload se armaría con `NaN`.
        if (typeof id !== 'number' || Number.isNaN(id)) {
          sinCaja();
          return;
        }
        setCajaActivaId(id);
        setCajaActivaMsg('');
        // `CierreCaja` lee la misma clave: se sincroniza para no romperlo.
        localStorage.setItem('cajaId', String(id));
      } catch (e: unknown) {
        // Sin caja abierta es un estado normal del POS, no un fallo: el botón
        // de cobrar queda deshabilitado y se avisa en pantalla.
        if (isApiError(e) && e.error === NO_CAJA_ABIERTA_API_MSG) {
          sinCaja();
          return;
        }
        console.error('Error cargando caja activa', e);
        sinCaja();
      }
    };
    fetchCajaActiva();
  }, []);

  // ── Confirmar cobro ────────────────────────────────────────
  //
  // Se exporta directo como `onConfirm` de `ModalPago`, que ya valida el monto
  // recibido contra el total con su propio estado y deshabilita el botón si no
  // alcanza. Antes había un `handleConfirmarPago` intermedio que re-validaba
  // contra un `metodoPago`/`recibido` del hook que nadie actualizaba: siempre
  // `'EFECTIVO'` y `''`, así que `puedeConfirmar` era siempre falso y el cobro
  // moría ahí sin llegar al POST. Que el gate viva en un solo lugar es el
  // punto: no re-derivar datos que el modal ya resolvió.
  const confirmarCobro = async (data: { metodo: MetodoPago; montoRecibido: number; vuelto: number }) => {
    // Sin caja resuelta no hay contra qué registrar la venta, así que la
    // request ni se envía: cobrando igual, el backend respondería 404 "Caja" o
    // 409 "La caja no está abierta".
    if (cajaActivaId === null) {
      setError(NO_CAJA_ABIERTA_MSG);
      setTimeout(() => setError(''), 3500);
      return;
    }

    const payload = {
      cajaId: cajaActivaId,
      items: carrito.map(i => ({ productoId: i.id, cantidad: i.cantidad })),
      descuento,
      metodoPago: data.metodo,
      montoRecibido: data.montoRecibido,
    };

    try {
      const ventaConfirmada = await api.post<{ id: number }>('/ventas', payload);

      const ventaFront: VentaFront = {
        id: ventaConfirmada.id,
        items: carrito.map(i => ({
          nombre: i.nombre,
          cantidad: i.cantidad,
          subtotal: i.precio * i.cantidad,
        })),
        total,
        metodo: data.metodo,
        vuelto: data.vuelto,
      };

      setVentaExitosa(ventaFront);
      setModal('ticket');
    } catch (e: unknown) {
      // `api` lanza el body plano `{ error, code }`, no una `Error`: leer
      // `message` daba siempre `undefined` y la UI mostraba "Error desconocido".
      const detalle = isApiError(e) ? e.error : '';
      setError(`Error al cobrar: ${detalle || 'Error desconocido'}`);
      setTimeout(() => setError(''), 3500);
      setModal(null);
    }
  };

  const nuevaVenta = () => {
    setCarrito([]);
    setDescuento(0);
    setBusqueda('');
    setModal(null);
    setVentaExitosa(null);
    searchRef.current?.focus();
  };

  // ── Búsqueda manual (Enter en input) ───────────────────────
  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && busqueda.trim()) {
      if (productosFiltrados.length === 1) {
        const prod = productosFiltrados[0];
        if (prod) agregarAlCarrito(prod);
        setBusqueda('');
      } else {
        buscarPorCodigo(busqueda);
      }
    }
  };

  // ── Handlers de UI ─────────────────────────────────────────
  const handleDescuentoChange = (e: ChangeEvent<HTMLInputElement>) => {
    setDescuento(parseFloat(e.target.value) || 0);
  };

  const handleMontoFocus = (e: FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.border = `1px solid ${C.accent}`;
  };

  const handleMontoBlur = (e: FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.border = `1px solid ${C.border}`;
  };

  const handleCloseModal = () => setModal(null);

  const handleNuevaVenta = () => nuevaVenta();

return {
    // Estado
    carrito,
    setCarrito,
    busqueda,
    setBusqueda,
    productosFiltrados,
    frecuentes,
    descuento,
    modal,
    ventaExitosa,
    error,
    cajaActivaId,
    cajaActivaMsg,
    scanning: false,
    flashId,
    searchRef,
    subtotal,
    total,
    // Handlers
    handleSearchKeyDown,
    handleDescuentoChange,
    handleMontoFocus,
    handleMontoBlur,
    handleCloseModal,
    handleNuevaVenta,
    agregarAlCarrito,
    cambiarCantidad,
    quitarItem,
    setFlashId,
    triggerFlash,
    setError,
    setModal,
    setDescuento,
    confirmarCobro,
  };
}