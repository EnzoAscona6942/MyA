import { useState, useEffect, useRef, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react';
import { api, getHeaders, API_URL } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useChunkedUpload } from '../hooks/useChunkedUpload';
import * as XLSX from 'xlsx';
import type { Categoria, Pagination, Producto } from '../types/api';

const C = {
  bg: '#F5F5F3',
  white: '#FFFFFF',
  sidebar: '#0A0A0A',
  text: '#171717',
  textMid: '#52525B',
  textLight: '#A1A1AA',
  border: 'rgba(0,0,0,0.15)',
  accent: '#10B981',
  accentHov: '#059669',
  accentBg: '#D1FAE5',
  danger: '#EF4444',
  dangerBg: '#FEE2E2',
  amber: '#F59E0B',
  amberBg: '#FEF3C7',
  blue: '#3B82F6',
  blueBg: '#DBEAFE'
} as const;

// ── Tipos locales ──────────────────────────────────────────────

/**
 * `precio` es `Decimal` en Prisma: llega serializado como string en runtime,
 * y `Intl.NumberFormat.format` sólo acepta `number`, así que se normaliza.
 */
const fmt = (num: number | string | null | undefined): string =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(num) || 0);

const DEFAULT_PAGE_SIZE = 20;

/** El endpoint de productos responde array plano (legacy) o `{ data, pagination }`. */
type RespuestaProductos = Producto[] | { data: Producto[]; pagination: Pagination };

interface ProductoForm {
  nombre: string;
  codigoBarras: string;
  descripcion: string;
  precio: string;
  stock: string;
  stockMinimo: string;
  categoriaId: string;
}

/**
 * Fila del Excel/CSV ya normalizada para `POST /productos/bulk`.
 * Los valores salen de `sheet_to_json` sin castear, por eso el backend los
 * normaliza con `String`/`parseFloat`/`parseInt`.
 */
interface BulkProductoFila {
  nombre: unknown;
  codigoBarras: unknown;
  descripcion: unknown;
  precio: unknown;
  stock: unknown;
  stockMinimo: unknown;
}

/**
 * Payload de `POST /productos` y `PUT /productos/:id`.
 * `descripcion` viaja como `null` (el backend no la valida y sí la acepta);
 * `codigoBarras` y `categoriaId` viajan como `undefined` porque
 * express-validator `.optional()` sólo salta `undefined`, no `null`.
 */
interface ProductoPayload {
  nombre: string;
  codigoBarras: string | undefined;
  descripcion: string | null;
  precio: number;
  stock: number;
  stockMinimo: number;
  categoriaId: number | undefined;
}

/** El cliente de API lanza `ApiError` (objeto plano), no una `Error`. */
interface ErrorLike {
  name?: string;
  message?: string;
  error?: string;
}

const asErrorLike = (e: unknown): ErrorLike =>
  typeof e === 'object' && e !== null ? (e as ErrorLike) : { message: String(e) };

// ── Lookup de nombre por código de barras (Open Food Facts) ────────

/**
 * Respuesta de `GET /productos/barras/:codigo/openfoodfacts`.
 * `found: false` es un resultado normal (panadería, granel, productos locales),
 * nunca un error: el operador escribe el nombre a mano en ese caso.
 */
interface RespuestaOpenFoodFacts {
  codigoBarras: string;
  found: boolean;
  nombre: string | null;
}

/** Estados de la línea de feedback bajo el input de código de barras. */
type LookupEstado = 'idle' | 'buscando' | 'encontrado' | 'no-encontrado' | 'error';

const LOOKUP_DEBOUNCE_MS = 400;

/** Código de barras válido: 8 a 14 dígitos, la forma de un EAN/UPC real. */
const CODIGO_BARRAS_VALIDO = /^\d{8,14}$/;

/**
 * Un lector USB de códigos de barras teclea el código y manda Enter al
 * terminar, así que ese es el disparador real; el debounce es sólo el respaldo
 * para cuando el operador lo carga a mano.
 */
const soloDigitos = (valor: string): string => valor.replace(/\D/g, '');

/** `categoria` llega como objeto en el formato actual y como string en el legacy. */
const nombreCategoria = (categoria: Categoria | string | null | undefined): string => {
  if (!categoria) return '-';
  return typeof categoria === 'string' ? categoria : categoria.nombre;
};

/** El input es de texto: los `Decimal` serializados llegan como string. */
const inputValue = (valor: number | string | null | undefined): string =>
  String(valor || '');

export default function Productos() {
  const { usuario } = useAuth();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chunkedUpload = useChunkedUpload<BulkProductoFila>({ apiUrl: API_URL, headers: getHeaders() });
  const [uploadError, setUploadError] = useState<string>('');
  const prevUploadStateRef = useRef<string>('idle');
  const fetchTriggeredRef = useRef<boolean>(false);

  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filtros
  const [busqueda, setBusqueda] = useState<string>('');
  const [categoriaId, setCategoriaId] = useState<string>('');

  // Pagination state
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
    total: 0,
    totalPages: 0
  });

  // Modal ABM
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form State
  const initialForm: ProductoForm = {
    nombre: '',
    codigoBarras: '',
    descripcion: '',
    precio: '',
    stock: '',
    stockMinimo: '',
    categoriaId: ''
  };
  const [formData, setFormData] = useState<ProductoForm>(initialForm);
  const [formError, setFormError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  // ── Lookup Open Food Facts ──
  const [lookupEstado, setLookupEstado] = useState<LookupEstado>('idle');
  const [lookupNombre, setLookupNombre] = useState<string>('');
  // Espejo de `formData.nombre`: la búsqueda se dispara desde un efecto que
  // sólo depende del código, así que no puede cerrar sobre el nombre.
  const nombreRef = useRef<string>('');
  const lookupAbortRef = useRef<AbortController | null>(null);
  const lookupTimerRef = useRef<number | null>(null);
  // Cada búsqueda corre con un número de secuencia: una respuesta que tarda
  // más que la siguiente no puede pisar el resultado del código más nuevo.
  const lookupSeqRef = useRef<number>(0);

  useEffect(() => {
    nombreRef.current = formData.nombre;
  }, [formData.nombre]);

  /** Cancela la petición en vuelo y el debounce pendiente. */
  const cancelarLookup = (): void => {
    if (lookupTimerRef.current !== null) {
      window.clearTimeout(lookupTimerRef.current);
      lookupTimerRef.current = null;
    }
    lookupAbortRef.current?.abort();
    lookupAbortRef.current = null;
    // Invalida cualquier respuesta que ya esté en camino.
    lookupSeqRef.current += 1;
  };

  const buscarNombreOpenFoodFacts = async (codigoBruto: string): Promise<void> => {
    const codigo = soloDigitos(codigoBruto);

    cancelarLookup();
    if (!CODIGO_BARRAS_VALIDO.test(codigo)) {
      setLookupEstado('idle');
      return;
    }

    // Nunca pisa un nombre que el operador ya escribió.
    if (nombreRef.current.trim() !== '') {
      setLookupEstado('idle');
      return;
    }

    const controller = new AbortController();
    lookupAbortRef.current = controller;
    const seq = lookupSeqRef.current;
    setLookupEstado('buscando');

    try {
      const res = await api.get<RespuestaOpenFoodFacts>(
        `/productos/barras/${codigo}/openfoodfacts`,
        { signal: controller.signal }
      );

      // Respuesta de un código viejo: se descarta.
      if (lookupSeqRef.current !== seq) return;

      const nombre = res.nombre;
      if (res.found && nombre) {
        setFormData(prev => ({ ...prev, nombre }));
        setLookupNombre(nombre);
        setLookupEstado('encontrado');
      } else {
        setLookupNombre('');
        setLookupEstado('no-encontrado');
      }
    } catch (e: unknown) {
      if (lookupSeqRef.current !== seq) return;
      // Una cancelación es esperada, no un fallo que haya que mostrar.
      if (asErrorLike(e).name === 'AbortError') return;
      setLookupNombre('');
      setLookupEstado('error');
    }
  };

  // Debounce sobre el código. La dependencia es sólo `codigoBarras`: si
  // dependiera también de `nombre`, el autocompletado volvería a disparar la
  // búsqueda y podría preguntar por el mismo código otra vez.
  useEffect(() => {
    if (!CODIGO_BARRAS_VALIDO.test(soloDigitos(formData.codigoBarras))) {
      cancelarLookup();
      setLookupEstado('idle');
      return;
    }

    const timer = window.setTimeout(() => {
      lookupTimerRef.current = null;
      void buscarNombreOpenFoodFacts(formData.codigoBarras);
    }, LOOKUP_DEBOUNCE_MS);
    lookupTimerRef.current = timer;

    return () => {
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.codigoBarras]);

  /** El Enter del lector dispara la búsqueda sin esperar el debounce. */
  const handleCodigoBarrasKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key !== 'Enter') return;
    // Evita que el Enter envíe el formulario entero.
    e.preventDefault();
    void buscarNombreOpenFoodFacts(formData.codigoBarras);
  };

  const lookupMensaje = (() => {
    switch (lookupEstado) {
      case 'buscando':
        return { texto: 'Buscando en Open Food Facts...', color: C.textMid };
      case 'encontrado':
        return { texto: `Encontrado: ${lookupNombre}`, color: C.accent };
      case 'no-encontrado':
        return { texto: 'No figura en Open Food Facts. Cargá el nombre a mano.', color: C.amber };
      case 'error':
        return {
          texto: 'No se pudo consultar Open Food Facts. Cargá el nombre a mano.',
          color: C.danger
        };
      default:
        return null;
    }
  })();

  // ── INIT ──
  useEffect(() => {
    fetchCategorias();
    fetchProductos();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProductos(1); // Reset to page 1 when filters change
    }, 300);
    return () => clearTimeout(timer);
  }, [busqueda, categoriaId]);

  // ── CHUNKED UPLOAD: confirm chain on paused ──
  useEffect(() => {
    const uploadErrorActual = chunkedUpload.error;
    if (chunkedUpload.state !== 'paused' || !uploadErrorActual) return;

    const { chunkIndex, message } = uploadErrorActual;
    const chunkNum = chunkIndex + 1;

    const retry = window.confirm(
      `El lote ${chunkNum} falló: ${message}. ¿Reintentar?`
    );

    if (retry) {
      chunkedUpload.retryChunk();
    } else {
      const skip = window.confirm(
        '¿Saltar este lote y continuar con el siguiente?'
      );

      if (skip) {
        chunkedUpload.skipChunk();
      } else {
        chunkedUpload.cancel();
      }
    }
  }, [chunkedUpload.state, chunkedUpload.error]);

  // ── CHUNKED UPLOAD: refetch products when upload finishes ──
  useEffect(() => {
    if (chunkedUpload.state === 'done' && !fetchTriggeredRef.current) {
      fetchTriggeredRef.current = true;
      fetchProductos();
    }
    if (chunkedUpload.state !== 'done') {
      fetchTriggeredRef.current = false;
    }
    prevUploadStateRef.current = chunkedUpload.state;
  }, [chunkedUpload.state]);

  // Handle pagination
  const handlePageChange = (newPage: number): void => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchProductos(newPage);
    }
  };

  const fetchCategorias = async (): Promise<void> => {
    try {
      const data = await api.get<Categoria[]>('/categorias');
      setCategorias(data);
    } catch (e: unknown) {
      console.error("Error al cargar categorías", e);
    }
  };

  const fetchProductos = async (page: number = 1): Promise<void> => {
    setLoading(true);
    try {
      const skip = (page - 1) * DEFAULT_PAGE_SIZE;
      const query = new URLSearchParams();
      if (busqueda) query.append('busqueda', busqueda);
      if (categoriaId) query.append('categoriaId', categoriaId);
      query.append('skip', skip.toString());
      query.append('take', DEFAULT_PAGE_SIZE.toString());

      const response = await api.get<RespuestaProductos>(`/productos?${query.toString()}`);
      // Handle both old format (array) and new format ({ data, pagination })
      if (Array.isArray(response)) {
        setProductos(response);
        setPagination({ page: 1, limit: DEFAULT_PAGE_SIZE, total: response.length, totalPages: 1 });
      } else {
        setProductos(response.data || []);
        setPagination(response.pagination || { page: 1, limit: DEFAULT_PAGE_SIZE, total: 0, totalPages: 0 });
      }
    } catch (e: unknown) {
      console.error("Error al cargar productos", e);
    } finally {
      setLoading(false);
    }
  };

  // ── ACTIONS ──
  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError('');
    setFormError('');
    setSuccess('');

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames.at(0);
      const worksheet = firstSheetName ? workbook.Sheets[firstSheetName] : undefined;
      const jsonStr = worksheet
        ? XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" })
        : [];

      const payloadProductos: BulkProductoFila[] = jsonStr.map(item => {
        // Encontramos keys case-insensitive para la carga
        const keys = Object.keys(item);
        const getVal = (possibleKeys: string[]): unknown => {
          const key = keys.find(k => possibleKeys.includes(k.toLowerCase().trim()));
          return key ? item[key] : null;
        };

        return {
          nombre: getVal(['nombre', 'producto', 'articulo']),
          codigoBarras: getVal(['codigo', 'códigobarras', 'codigobarras', 'barras', 'ean']),
          descripcion: getVal(['descripcion', 'descripción', 'detalle']),
          precio: getVal(['precio', 'precio final', 'precio_final', 'venta']),
          stock: getVal(['stock', 'cantidad', 'física', 'fisica']),
          stockMinimo: getVal(['minimo', 'mínimo', 'stock minimo', 'alerta', 'stockminimo'])
        };
      }).filter(p => p.nombre && p.codigoBarras);

      if (payloadProductos.length === 0) {
        setUploadError('No se encontraron productos válidos en el archivo. Verifica las columnas (Nombre y Código obligatorios).');
        return;
      }

      // Chunked upload via hook — sequential 250-product chunks
      await chunkedUpload.upload(payloadProductos);
    } catch (err: unknown) {
      const error = asErrorLike(err);
      if (error.name !== 'AbortError') {
        setUploadError("Error al procesar el archivo: " + (error.error || error.message || "Error desconocido"));
      }
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleOpenNuevo = (): void => {
    setEditingId(null);
    setFormData(initialForm);
    setFormError('');
    cancelarLookup();
    setLookupEstado('idle');
    setLookupNombre('');
    setShowModal(true);
  };

  const handleOpenEdit = (p: Producto): void => {
    setEditingId(p.id);
    setFormData({
      nombre: p.nombre,
      codigoBarras: p.codigoBarras || '',
      descripcion: p.descripcion || '',
      precio: inputValue(p.precio),
      stock: inputValue(p.stock),
      stockMinimo: inputValue(p.stockMinimo),
      // El backend manda `categoria` como objeto y `categoriaId` como número.
      categoriaId: p.categoriaId != null ? String(p.categoriaId) : ''
    });
    setFormError('');
    cancelarLookup();
    setLookupEstado('idle');
    setLookupNombre('');
    setShowModal(true);
  };

  const handleCloseModal = (): void => {
    // Cancelar la consulta en vuelo: si llegara después, escribiría el nombre
    // en un formulario que el operador ya cerró.
    cancelarLookup();
    setLookupEstado('idle');
    setLookupNombre('');
    setShowModal(false);
  };

  const handleDelete = async (id: number, nombre: string): Promise<void> => {
    if (!window.confirm(`¿Estás seguro que deseas dar de baja el producto: ${nombre}?`)) return;
    try {
      await api.delete<{ mensaje: string }>(`/productos/${id}`);
      setSuccess(`Producto "${nombre}" eliminado correctamente.`);
      setTimeout(() => setSuccess(''), 3000);
      fetchProductos();
    } catch (e: unknown) {
      const error = asErrorLike(e);
      alert("Error al eliminar producto: " + (error.error || error.message));
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setFormError('');

    const payload: ProductoPayload = {
      nombre: formData.nombre,
      // `undefined`, no `null`: express-validator `.optional()` sólo salta `undefined`.
      codigoBarras: formData.codigoBarras || undefined,
      descripcion: formData.descripcion || null,
      precio: parseFloat(formData.precio),
      stock: parseInt(formData.stock, 10),
      stockMinimo: parseInt(formData.stockMinimo, 10),
      categoriaId: formData.categoriaId ? parseInt(formData.categoriaId, 10) : undefined
    };

    try {
      if (editingId) {
        await api.put<Producto>(`/productos/${editingId}`, payload);
        setSuccess('Producto modificado exitosamente.');
      } else {
        await api.post<Producto>('/productos', payload);
        setSuccess('Producto creado exitosamente.');
      }
      setShowModal(false);
      setTimeout(() => setSuccess(''), 3000);
      fetchProductos();
    } catch (e: unknown) {
      setFormError(asErrorLike(e).error || "Error al guardar el producto");
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  if (usuario?.rol !== 'ADMIN') {
    return <div style={{ padding: 40, fontFamily: "'DM Mono', monospace" }}>Acceso restringido. Solo administradores.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: C.bg, fontFamily: "'DM Mono', monospace" }}>

      {/* ── HEADER ── */}
      <div style={{ padding: "32px 32px 24px 32px", borderBottom: `1px solid ${C.border}`, background: C.white, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text, marginBottom: 4 }}>Catálogo de Productos</h1>
          <p style={{ fontSize: 13, color: C.textLight }}>Alta, baja y modificación de mercadería.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <input
            type="file"
            accept=".xlsx, .xls, .csv"
            style={{ display: 'none' }}
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          <button onClick={() => fileInputRef.current?.click()} disabled={chunkedUpload.state === 'uploading'} style={{
            padding: "12px 20px", borderRadius: 0, background: C.white, color: C.text,
            border: `1px solid ${C.text}`, fontWeight: 700, fontSize: 13, cursor: chunkedUpload.state === 'uploading' ? "wait" : "pointer", transition: "opacity 0.2s"
          }} onMouseEnter={e => e.currentTarget.style.opacity = "0.8"} onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
            {chunkedUpload.state === 'uploading' ? "Subiendo..." : "⬆ Carga Excel/CSV"}
          </button>
          <button onClick={handleOpenNuevo} style={{
            padding: "12px 20px", borderRadius: 0, background: C.text, color: "#fff",
            border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer", transition: "opacity 0.2s"
          }} onMouseEnter={e => e.currentTarget.style.opacity = "0.8"} onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
            + Nuevo Producto
          </button>
        </div>
      </div>

      {/* ── ALERTS ── */}
      {/* Upload progress bar */}
      {(chunkedUpload.state === 'uploading' || chunkedUpload.state === 'paused') && (
        <div style={{ padding: "0 32px", marginTop: 24 }}>
          <div style={{ background: '#E5E7EB', borderRadius: 0, overflow: 'hidden', marginBottom: 8, height: 6 }}>
            <div style={{
              background: chunkedUpload.state === 'paused' ? C.amber : C.blue,
              width: `${chunkedUpload.progress.percent}%`,
              height: '100%',
              transition: 'width 0.3s ease'
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: C.textMid }}>
              Lote {chunkedUpload.progress.currentChunk}/{chunkedUpload.progress.totalChunks} ·{' '}
              {chunkedUpload.progress.processedProducts.toLocaleString()}/{chunkedUpload.progress.totalProducts.toLocaleString()} productos
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
              {chunkedUpload.progress.percent}%
            </span>
          </div>
          {/* Cancel button visible only during active upload */}
          {chunkedUpload.state === 'uploading' && (
            <div style={{ marginTop: 8 }}>
              <button onClick={chunkedUpload.cancel} style={{
                padding: "6px 14px", borderRadius: 0, border: `1px solid ${C.danger}`,
                background: C.white, color: C.danger, cursor: 'pointer',
                fontSize: 12, fontWeight: 600, fontFamily: "inherit"
              }}>
                Cancelar carga
              </button>
            </div>
          )}
        </div>
      )}

      {/* Upload summary (done / cancelled) */}
      {(chunkedUpload.state === 'done' || chunkedUpload.state === 'cancelled') && (
        <div style={{ padding: "0 32px", marginTop: 24 }}>
          <div style={{
            background: chunkedUpload.state === 'done' ? C.accentBg : C.amberBg,
            color: chunkedUpload.state === 'done' ? C.accent : C.amber,
            padding: 16, borderRadius: 0, fontSize: 13, fontWeight: 600,
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
          }}>
            <div>
              <div style={{ marginBottom: 4 }}>
                {chunkedUpload.state === 'done' ? '✓ Carga completada' : '⚠ Carga cancelada (resultados parciales)'}
              </div>
              <div style={{ fontWeight: 400, opacity: 0.9 }}>
                {chunkedUpload.results.creados} creados · {chunkedUpload.results.actualizados} actualizados · {chunkedUpload.results.errores} errores
              </div>
              <div style={{ fontWeight: 400, opacity: 0.7, fontSize: 12, marginTop: 2 }}>
                {chunkedUpload.results.chunksCompletados}/{chunkedUpload.results.totalChunks} lotes procesados
              </div>
            </div>
            <button onClick={chunkedUpload.reset} style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'inherit', fontSize: 16, fontWeight: 700, lineHeight: 1,
              padding: '0 0 0 12px', opacity: 0.6
            }} title="Cerrar">×</button>
          </div>
        </div>
      )}

      {/* Upload fatal error (hook crashed unexpectedly) */}
      {chunkedUpload.state === 'error' && chunkedUpload.error && (
        <div style={{ padding: "0 32px", marginTop: 24 }}>
          <div style={{
            background: C.dangerBg, color: C.danger, padding: 16, borderRadius: 0,
            fontSize: 13, fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
          }}>
            <div>
              <div style={{ marginBottom: 4 }}>✗ Error inesperado</div>
              <div style={{ fontWeight: 400, opacity: 0.9 }}>{chunkedUpload.error.message}</div>
            </div>
            <button onClick={chunkedUpload.reset} style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'inherit', fontSize: 16, fontWeight: 700, lineHeight: 1,
              padding: '0 0 0 12px', opacity: 0.6
            }} title="Cerrar">×</button>
          </div>
        </div>
      )}

      {/* Upload parse/validation error (e.g., empty file) */}
      {uploadError && (
        <div style={{ padding: "0 32px", marginTop: 24 }}>
          <div style={{ background: C.dangerBg, color: C.danger, padding: 12, borderRadius: 0, fontSize: 13, fontWeight: 600 }}>
            ⚠ {uploadError}
          </div>
        </div>
      )}

      {/* CRUD success banner */}
      {success && (
        <div style={{ padding: "0 32px", marginTop: 24 }}>
          <div style={{ background: C.accentBg, color: C.accent, padding: 12, borderRadius: 0, fontSize: 13, fontWeight: 600 }}>
            ✓ {success}
          </div>
        </div>
      )}

      {/* ── CONTENIDO ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: 32 }}>

        {/* Filtros */}
        <div style={{ display: "flex", gap: 16, background: C.white, padding: 16, borderRadius: 0, border: `1px solid ${C.border}`, alignItems: "flex-end", marginBottom: 24 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 6 }}>BUSCAR POR NOMBRE O CÓDIGO BARRAS</label>
            <input
              type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Ej: Fideos..."
              style={{ width: "100%", padding: "10px 14px", borderRadius: 0, border: `1px solid ${C.border}`, outline: "none", fontFamily: "inherit", fontSize: 13 }}
              onFocus={e => e.target.style.border = `1px solid ${C.accent}`} onBlur={e => e.target.style.border = `1px solid ${C.border}`}
            />
          </div>
          <div style={{ width: 250 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 6 }}>FILTRAR POR CATEGORÍA</label>
            <select
              value={categoriaId} onChange={e => setCategoriaId(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", borderRadius: 0, border: `1px solid ${C.border}`, outline: "none", fontFamily: "inherit", fontSize: 13, background: C.white }}
            >
              <option value="">Todas las categorías</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
        </div>

        {/* Tabla */}
        <div style={{ background: C.white, borderRadius: 0, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#F9FAFB", borderBottom: `1px solid ${C.border}` }}>
                <th style={{ padding: "14px 20px", fontSize: 11, fontWeight: 600, color: C.textLight, textTransform: "uppercase" }}>Código</th>
                <th style={{ padding: "14px 20px", fontSize: 11, fontWeight: 600, color: C.textLight, textTransform: "uppercase" }}>Producto</th>
                <th style={{ padding: "14px 20px", fontSize: 11, fontWeight: 600, color: C.textLight, textTransform: "uppercase" }}>Categoría</th>
                <th style={{ padding: "14px 20px", fontSize: 11, fontWeight: 600, color: C.textLight, textTransform: "uppercase", textAlign: "right" }}>Precio Final</th>
                <th style={{ padding: "14px 20px", fontSize: 11, fontWeight: 600, color: C.textLight, textTransform: "uppercase", textAlign: "right" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: C.textLight, fontSize: 13 }}>Cargando datos...</td></tr>
              ) : productos.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: C.textLight, fontSize: 13 }}>No se encontraron registros.</td></tr>
              ) : (
                productos.map((p, i) => (
                  <tr key={p.id} style={{ borderBottom: i < productos.length - 1 ? `1px solid ${C.border}` : "none", transition: "background 0.1s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#F9FAFB"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={{ padding: "14px 20px", fontSize: 12, color: C.textLight, fontFamily: "'DM Mono', monospace" }}>{p.codigoBarras || "-"}</td>
                    <td style={{ padding: "14px 20px", fontSize: 13, fontWeight: 600, color: C.text }}>{p.nombre}</td>
                    <td style={{ padding: "14px 20px", fontSize: 12, color: C.textMid }}>{nombreCategoria(p.categoria)}</td>
                    <td style={{ padding: "14px 20px", fontSize: 14, fontWeight: 700, fontFamily: "'DM Mono', monospace", textAlign: "right", color: C.text }}>{fmt(p.precio)}</td>
                    <td style={{ padding: "14px 20px", textAlign: "right" }}>
                      <button onClick={() => handleOpenEdit(p)} style={{ background: "none", border: "none", color: C.blue, cursor: "pointer", fontSize: 13, fontWeight: 600, marginRight: 16 }}>Editar</button>
                      <button onClick={() => handleDelete(p.id, p.nombre)} style={{ background: "none", border: "none", color: C.danger, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Borrar</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── PAGINATION CONTROLS ── */}
        {pagination.totalPages > 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderTop: `1px solid ${C.border}`, background: C.white }}>
            <div style={{ fontSize: 13, color: C.textMid }}>
              Mostrando <strong>{(pagination.page - 1) * pagination.limit + 1}</strong> - <strong>{Math.min(pagination.page * pagination.limit, pagination.total)}</strong> de <strong>{pagination.total}</strong> productos
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                style={{
                  padding: "8px 14px",
                  borderRadius: 0,
                  border: `1px solid ${pagination.page <= 1 ? '#E5E7EB' : C.border}`,
                  background: pagination.page <= 1 ? '#F9FAFB' : C.white,
                  color: pagination.page <= 1 ? '#9CA3AF' : C.text,
                  cursor: pagination.page <= 1 ? "not-allowed" : "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "'DM Mono', monospace"
                }}
              >
                ← Anterior
              </button>

              <span style={{ fontSize: 13, color: C.textMid, padding: "0 8px" }}>
                Página <strong>{pagination.page}</strong> de <strong>{pagination.totalPages}</strong>
              </span>

              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                style={{
                  padding: "8px 14px",
                  borderRadius: 0,
                  border: `1px solid ${pagination.page >= pagination.totalPages ? '#E5E7EB' : C.border}`,
                  background: pagination.page >= pagination.totalPages ? '#F9FAFB' : C.white,
                  color: pagination.page >= pagination.totalPages ? '#9CA3AF' : C.text,
                  cursor: pagination.page >= pagination.totalPages ? "not-allowed" : "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "'DM Mono', monospace"
                }}
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ── MODAL ABM ── */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 24 }}>
          <div style={{ background: C.white, padding: 32, borderRadius: 0, width: "100%", maxWidth: 600, maxHeight: "90vh", overflowY: "auto", boxShadow: "none" }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 24 }}>
              {editingId ? "Editar Producto" : "Nuevo Producto"}
            </h2>

            {formError && <div style={{ background: C.dangerBg, color: C.danger, padding: 12, borderRadius: 0, fontSize: 13, marginBottom: 20, fontWeight: 600 }}>⚠ {formError}</div>}

            <form onSubmit={handleSubmit}>
              {/* Nombre & Codigo */}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.textMid, marginBottom: 6 }}>Nombre del Artículo *</label>
                  <input required type="text" name="nombre" value={formData.nombre} onChange={handleChange} style={{ width: "100%", padding: "10px", borderRadius: 0, border: `1px solid ${C.border}`, outline: "none", fontFamily: "inherit" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.textMid, marginBottom: 6 }}>Código de Barras</label>
                  <input type="text" name="codigoBarras" value={formData.codigoBarras} onChange={handleChange} onKeyDown={handleCodigoBarrasKeyDown} inputMode="numeric" placeholder="Escaneá acá..." style={{ width: "100%", padding: "10px", borderRadius: 0, border: `1px solid ${C.border}`, outline: "none", fontFamily: "inherit" }} />
                  {lookupMensaje && (
                    <div role="status" style={{ marginTop: 6, fontSize: 11, lineHeight: 1.4, color: lookupMensaje.color }}>
                      {lookupMensaje.texto}
                    </div>
                  )}
                </div>
              </div>

              {/* Categoria & Precio */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.textMid, marginBottom: 6 }}>Categoría</label>
                  <select name="categoriaId" value={formData.categoriaId} onChange={handleChange} style={{ width: "100%", padding: "10px", borderRadius: 0, border: `1px solid ${C.border}`, outline: "none", fontFamily: "inherit", background: C.white }}>
                    <option value="">(Sin categoría)</option>
                    {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.textMid, marginBottom: 6 }}>Precio de Venta Final $ *</label>
                  <input required type="number" step="0.01" min="0" name="precio" value={formData.precio} onChange={handleChange} style={{ width: "100%", padding: "10px", borderRadius: 0, border: `1px solid ${C.border}`, outline: "none", fontFamily: "'DM Mono', monospace" }} />
                </div>
              </div>

              {/* Stock */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.textMid, marginBottom: 6 }}>Stock Actual Física *</label>
                  <input required type="number" min="0" name="stock" value={formData.stock} onChange={handleChange} style={{ width: "100%", padding: "10px", borderRadius: 0, border: `1px solid ${C.border}`, outline: "none", fontFamily: "'DM Mono', monospace" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.textMid, marginBottom: 6 }}>Alerta de Stock Mínimo *</label>
                  <input required type="number" min="0" name="stockMinimo" value={formData.stockMinimo} onChange={handleChange} style={{ width: "100%", padding: "10px", borderRadius: 0, border: `1px solid ${C.border}`, outline: "none", fontFamily: "'DM Mono', monospace" }} />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 32, paddingTop: 20, borderTop: `1px solid ${C.border}` }}>
                <button type="button" onClick={handleCloseModal} style={{ padding: "12px 20px", borderRadius: 0, border: `1px solid ${C.border}`, background: C.white, cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}>
                  Cancelar
                </button>
                <button type="submit" style={{ padding: "12px 24px", borderRadius: 0, border: "none", background: C.text, color: "#fff", cursor: "pointer", fontWeight: 700, fontFamily: "inherit", transition: "opacity 0.2s" }} onMouseEnter={e => e.currentTarget.style.opacity = "0.8"} onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
                  {editingId ? "Guardar Cambios" : "Crear Producto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
