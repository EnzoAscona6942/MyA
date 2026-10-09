// ============================================================
// STOCK - LOGIC (estado, datos y submit del ingreso)
// ============================================================

import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import type {
  ApiError,
  Categoria,
  IngresoStockCreate,
  Producto,
  Proveedor
} from '../../types/api';
import type {
  ActiveTab,
  Filtros,
  FormIngreso,
  ItemIngresoForm,
  RespuestaProductos
} from './types';
import { normalizarProductos } from './types';

const FILTROS_INICIALES: Filtros = { busqueda: '', categoriaId: '', stockBajo: false };
const FORM_INICIAL: FormIngreso = { proveedorId: '', numeroRemito: '', observaciones: '' };
const DEBOUNCE_MS = 300;

export function useStockLogic() {
  const { usuario } = useAuth();

  const [activeTab, setActiveTab] = useState<ActiveTab>('listado');

  // ── Listado ──
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIALES);
  const [loading, setLoading] = useState(false);

  // ── Ingreso ──
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [formIngreso, setFormIngreso] = useState<FormIngreso>(FORM_INICIAL);
  const [itemsIngreso, setItemsIngreso] = useState<ItemIngresoForm[]>([]);
  const [busquedaProdForm, setBusquedaProdForm] = useState('');
  const [sugerenciasProd, setSugerenciasProd] = useState<Producto[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState('');
  const [formError, setFormError] = useState('');

  // ── Catálogos ──────────────────────────────────────────────
  useEffect(() => {
    api.get<Categoria[]>('/categorias').then(setCategorias).catch(console.error);
    api.get<Proveedor[]>('/proveedores').then(setProveedores).catch(console.error);
  }, []);

  // ── Listado ────────────────────────────────────────────────
  // Depende de los primitivos, no del objeto `filtros`, para que la
  // identidad de la función no cambie en cada tecla.
  const fetchProductos = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (filtros.busqueda) query.append('busqueda', filtros.busqueda);
      if (filtros.categoriaId) query.append('categoriaId', filtros.categoriaId);
      if (filtros.stockBajo) query.append('stockBajo', 'true');

      const data = await api.get<RespuestaProductos>(`/productos?${query.toString()}`);
      setProductos(normalizarProductos(data));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filtros.busqueda, filtros.categoriaId, filtros.stockBajo]);

  // Un solo efecto con debounce: el original disparaba un fetch inmediato
  // por tecla (primer effect) y otro 300ms después (segundo effect).
  useEffect(() => {
    if (activeTab !== 'listado') return;
    const timer = setTimeout(() => {
      fetchProductos();
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [
    activeTab,
    filtros.busqueda,
    filtros.categoriaId,
    filtros.stockBajo,
    fetchProductos
  ]);

  // ── Sugerencias de productos para el ingreso ───────────────
  useEffect(() => {
    const term = busquedaProdForm.trim();
    if (term.length < 2) {
      setSugerenciasProd([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get<RespuestaProductos>(
          `/productos?busqueda=${encodeURIComponent(term)}`
        );
        setSugerenciasProd(normalizarProductos(res));
      } catch (e) {
        console.error(e);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [busquedaProdForm]);

  // ── Mutadores del remito ───────────────────────────────────
  const addProductoToIngreso = (prod: Producto) => {
    if (itemsIngreso.some(i => i.productoId === prod.id)) return;
    setItemsIngreso(prev => [
      ...prev,
      {
        productoId: prod.id,
        nombre: prod.nombre,
        cantidad: 1,
        precioUnitario: ''
      }
    ]);
    setSugerenciasProd([]);
    setBusquedaProdForm('');
  };

  const quitarItemIngreso = (id: number) => {
    setItemsIngreso(prev => prev.filter(i => i.productoId !== id));
  };

  const updateItemIngreso = (
    id: number,
    field: 'cantidad' | 'precioUnitario',
    value: string
  ) => {
    setItemsIngreso(prev =>
      prev.map(i =>
        i.productoId === id
          ? field === 'cantidad'
            ? { ...i, cantidad: value }
            : { ...i, precioUnitario: value }
          : i
      )
    );
  };

  const resetFormIngreso = () => {
    setFormIngreso(FORM_INICIAL);
    setItemsIngreso([]);
    setBusquedaProdForm('');
  };

  // ── Submit ─────────────────────────────────────────────────
  const handleIngresoSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (itemsIngreso.length === 0) {
      setFormError('Agrega al menos un producto al ingreso');
      return;
    }
    setFormError('');
    setSubmitting(true);
    try {
      // `ingresoStockSchema` usa `.optional()`, que acepta `undefined`
      // pero NO `null`: se omiten las claves vacías en vez de mandarlas.
      const payload: IngresoStockCreate = {
        items: itemsIngreso.map(i => ({
          productoId: i.productoId,
          cantidad: parseInt(String(i.cantidad), 10),
          ...(i.precioUnitario === ''
            ? {}
            : { precioUnitario: parseFloat(String(i.precioUnitario)) })
        })),
        ...(formIngreso.proveedorId
          ? { proveedorId: Number(formIngreso.proveedorId) }
          : {}),
        numeroRemito: formIngreso.numeroRemito,
        observaciones: formIngreso.observaciones
      };
      await api.post('/stock/ingreso', payload);
      setFormSuccess('Ingreso de stock guardado exitosamente.');
      setTimeout(() => setFormSuccess(''), 3000);
      resetFormIngreso();
    } catch (err) {
      if (err instanceof TypeError) {
        setFormError('Error de red');
      } else {
        setFormError((err as ApiError)?.error || 'Error al guardar ingreso');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return {
    usuario,
    activeTab,
    setActiveTab,
    productos,
    categorias,
    filtros,
    setFiltros,
    loading,
    proveedores,
    formIngreso,
    setFormIngreso,
    itemsIngreso,
    busquedaProdForm,
    setBusquedaProdForm,
    sugerenciasProd,
    submitting,
    formSuccess,
    formError,
    addProductoToIngreso,
    quitarItemIngreso,
    updateItemIngreso,
    resetFormIngreso,
    handleIngresoSubmit
  };
}