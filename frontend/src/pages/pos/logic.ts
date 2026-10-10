// ============================================================
// POS - LOGIC & HOOKS
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { C, type CartItem, type VentaFront, type ModalType, type MetodoPago } from './types';
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

  // ── Confirmar cobro ────────────────────────────────────────
  const confirmarCobro = async (data: { metodo: MetodoPago; montoRecibido: number; vuelto: number }) => {
    const cajaId = localStorage.getItem('cajaId') || '1';
    const payload = {
      cajaId: parseInt(cajaId),
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
      const err = e as { message?: string };
      setError(`Error al cobrar: ${err.message || 'Error desconocido'}`);
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

  const handleRecibidoChange = (e: ChangeEvent<HTMLInputElement>) => {
    setRecibido(e.target.value);
  };

  const handleMontoFocus = (e: FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.border = `1px solid ${C.accent}`;
  };

  const handleMontoBlur = (e: FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.border = `1px solid ${C.border}`;
  };

  const handleMetodoChange = (metodo: MetodoPago) => {
    setMetodoPago(metodo);
  };

  // Estado para método de pago (local al hook)
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('EFECTIVO');
  const [recibido, setRecibido] = useState('');

  const vuelto = metodoPago === 'EFECTIVO' && recibido ? parseFloat(recibido) - total : null;
  const puedeConfirmar = metodoPago !== 'EFECTIVO' || (recibido && parseFloat(recibido) >= total);

  const handleConfirmarPago = () => {
    if (!puedeConfirmar) return;
    confirmarCobro({ metodo: metodoPago, montoRecibido: parseFloat(recibido) || total, vuelto: vuelto || 0 });
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
    scanning: false,
    flashId,
    searchRef,
    metodoPago,
    recibido,
    setRecibido,
    vuelto,
    puedeConfirmar,
    subtotal,
    total,
    // Handlers
    handleSearchKeyDown,
    handleDescuentoChange,
    handleRecibidoChange,
    handleMontoFocus,
    handleMontoBlur,
    handleMetodoChange,
    handleConfirmarPago,
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
    setMetodoPago,
  };
}