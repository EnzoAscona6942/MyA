import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';

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
};

const fmt = (num) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(num || 0);
const DEFAULT_PAGE_SIZE = 20;

export default function Productos() {
  const { usuario } = useAuth();
  
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);

  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [categoriaId, setCategoriaId] = useState('');

  // Pagination state
  const [pagination, setPagination] = useState({
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
    total: 0,
    totalPages: 0
  });

  // Modal ABM
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  // Form State
  const initialForm = {
    nombre: '',
    codigoBarras: '',
    descripcion: '',
    precio: '',
    stock: '',
    stockMinimo: '',
    categoriaId: ''
  };
  const [formData, setFormData] = useState(initialForm);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');

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

  // Handle pagination
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchProductos(newPage);
    }
  };

  const fetchCategorias = async () => {
    try {
      const data = await api.get('/categorias');
      setCategorias(data);
    } catch (e) {
      console.error("Error al cargar categorías", e);
    }
  };

  const fetchProductos = async (page = 1) => {
    setLoading(true);
    try {
      const skip = (page - 1) * DEFAULT_PAGE_SIZE;
      let query = new URLSearchParams();
      if (busqueda) query.append('busqueda', busqueda);
      if (categoriaId) query.append('categoriaId', categoriaId);
      query.append('skip', skip.toString());
      query.append('take', DEFAULT_PAGE_SIZE.toString());
      
      const response = await api.get(`/productos?${query.toString()}`);
      // Handle both old format (array) and new format ({ data, pagination })
      if (Array.isArray(response)) {
        setProductos(response);
        setPagination({ page: 1, limit: DEFAULT_PAGE_SIZE, total: response.length, totalPages: 1 });
      } else {
        setProductos(response.data || []);
        setPagination(response.pagination || { page: 1, limit: DEFAULT_PAGE_SIZE, total: 0, totalPages: 0 });
      }
    } catch (e) {
      console.error("Error al cargar productos", e);
    } finally {
      setLoading(false);
    }
  };

  // ── ACTIONS ──
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setFormError('');
    setSuccess('');

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonStr = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

      const payloadProductos = jsonStr.map(item => {
        // Encontramos keys case-insensitive para la carga
        const keys = Object.keys(item);
        const getVal = (possibleKeys) => {
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
        throw new Error('No se encontraron productos válidos en el archivo. Verifica las columnas (Nombre y Código obligatorios).');
      }

      const response = await api.post('/productos/bulk', { productos: payloadProductos });
      setSuccess(`Carga masiva: ${response.creados} agregados, ${response.actualizados} actualizados, ${response.errores} errores.`);
      fetchProductos();
    } catch (err) {
      alert("Error al procesar el archivo: " + (err.error || err.message || "Error desconocido"));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleOpenNuevo = () => {
    setEditingId(null);
    setFormData(initialForm);
    setFormError('');
    setShowModal(true);
  };

  const handleOpenEdit = (p) => {
    setEditingId(p.id);
    setFormData({
      nombre: p.nombre,
      codigoBarras: p.codigoBarras || '',
      descripcion: p.descripcion || '',
      precio: p.precio || '',
      stock: p.stock || '',
      stockMinimo: p.stockMinimo || '',
      categoriaId: categorias.find(c => c.nombre === p.categoria)?.id || ''
    });
    setFormError('');
    setShowModal(true);
  };

  const handleDelete = async (id, nombre) => {
    if (!window.confirm(`¿Estás seguro que deseas dar de baja el producto: ${nombre}?`)) return;
    try {
      await api.delete(`/productos/${id}`);
      setSuccess(`Producto "${nombre}" eliminado correctamente.`);
      setTimeout(() => setSuccess(''), 3000);
      fetchProductos();
    } catch (e) {
      alert("Error al eliminar producto: " + (e.error || e.message));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    
    const payload = {
      nombre: formData.nombre,
      codigoBarras: formData.codigoBarras || null,
      descripcion: formData.descripcion || null,
      precio: parseFloat(formData.precio),
      stock: parseInt(formData.stock, 10),
      stockMinimo: parseInt(formData.stockMinimo, 10),
      categoriaId: formData.categoriaId ? parseInt(formData.categoriaId, 10) : null
    };

    try {
      if (editingId) {
        await api.put(`/productos/${editingId}`, payload);
        setSuccess('Producto modificado exitosamente.');
      } else {
        await api.post('/productos', payload);
        setSuccess('Producto creado exitosamente.');
      }
      setShowModal(false);
      setTimeout(() => setSuccess(''), 3000);
      fetchProductos();
    } catch (e) {
      setFormError(e.error || "Error al guardar el producto");
    }
  };

  const handleChange = (e) => {
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
          <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} style={{
            padding: "12px 20px", borderRadius: 0, background: C.white, color: C.text,
            border: `1px solid ${C.text}`, fontWeight: 700, fontSize: 13, cursor: isUploading ? "wait" : "pointer", transition: "opacity 0.2s"
          }} onMouseEnter={e => e.currentTarget.style.opacity = 0.8} onMouseLeave={e => e.currentTarget.style.opacity = 1}>
            {isUploading ? "Cargando..." : "⬆ Carga Excel/CSV"}
          </button>
          <button onClick={handleOpenNuevo} style={{
            padding: "12px 20px", borderRadius: 0, background: C.text, color: "#fff",
            border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer", transition: "opacity 0.2s"
          }} onMouseEnter={e => e.currentTarget.style.opacity = 0.8} onMouseLeave={e => e.currentTarget.style.opacity = 1}>
            + Nuevo Producto
          </button>
        </div>
      </div>

      {/* ── ALERTS ── */}
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
                  <tr><td colSpan="5" style={{ padding: 24, textAlign: "center", color: C.textLight, fontSize: 13 }}>Cargando datos...</td></tr>
               ) : productos.length === 0 ? (
                  <tr><td colSpan="5" style={{ padding: 24, textAlign: "center", color: C.textLight, fontSize: 13 }}>No se encontraron registros.</td></tr>
               ) : (
                 productos.map((p, i) => (
                   <tr key={p.id} style={{ borderBottom: i < productos.length - 1 ? `1px solid ${C.border}` : "none", transition: "background 0.1s" }}
                       onMouseEnter={e => e.currentTarget.style.background = "#F9FAFB"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                   >
                     <td style={{ padding: "14px 20px", fontSize: 12, color: C.textLight, fontFamily: "'DM Mono', monospace" }}>{p.codigoBarras || "-"}</td>
                     <td style={{ padding: "14px 20px", fontSize: 13, fontWeight: 600, color: C.text }}>{p.nombre}</td>
                     <td style={{ padding: "14px 20px", fontSize: 12, color: C.textMid }}>{p.categoria?.nombre || p.categoria || "-"}</td>
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
                   <input type="text" name="codigoBarras" value={formData.codigoBarras} onChange={handleChange} placeholder="Escaneá acá..." style={{ width: "100%", padding: "10px", borderRadius: 0, border: `1px solid ${C.border}`, outline: "none", fontFamily: "inherit" }} />
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
                  <button type="button" onClick={() => setShowModal(false)} style={{ padding: "12px 20px", borderRadius: 0, border: `1px solid ${C.border}`, background: C.white, cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}>
                    Cancelar
                  </button>
                  <button type="submit" style={{ padding: "12px 24px", borderRadius: 0, border: "none", background: C.text, color: "#fff", cursor: "pointer", fontWeight: 700, fontFamily: "inherit", transition: "opacity 0.2s" }} onMouseEnter={e => e.currentTarget.style.opacity = 0.8} onMouseLeave={e => e.currentTarget.style.opacity = 1}>
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
