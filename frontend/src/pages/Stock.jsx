import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

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

const _fmt = (num) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(num || 0);

export default function Stock() {
  const { usuario } = useAuth();
  const [activeTab, setActiveTab] = useState('listado'); // 'listado' | 'ingreso'

  // ── ESTADO PARA TAB LISTADO ──
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [filtros, setFiltros] = useState({ busqueda: '', categoriaId: '', stockBajo: false });
  const [loading, setLoading] = useState(false);

  // ── ESTADO PARA TAB INGRESO ──
  const [proveedores, setProveedores] = useState([]);
  const [formIngreso, setFormIngreso] = useState({ proveedorId: '', numeroRemito: '', observaciones: '' });
  const [itemsIngreso, setItemsIngreso] = useState([]); // { productoId, nombre, cantidad, precioUnitario }
  const [busquedaProdForm, setBusquedaProdForm] = useState('');
  const [sugerenciasProd, setSugerenciasProd] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState('');
  const [formError, setFormError] = useState('');

  // ── EFECTOS DE REDUX Y DATOS BASE ──
  useEffect(() => {
    // Cargar catálogos
    api.get('/categorias').then(setCategorias).catch(console.error);
    api.get('/proveedores').then(setProveedores).catch(console.error);
  }, []);

  // fetchProductos ANTES de los effects que lo referencian (evita TDZ)
  const fetchProductos = useCallback(async () => {
    setLoading(true);
    try {
      let query = new URLSearchParams();
      if (filtros.busqueda) query.append('busqueda', filtros.busqueda);
      if (filtros.categoriaId) query.append('categoriaId', filtros.categoriaId);
      if (filtros.stockBajo) query.append('stockBajo', 'true');
      
      const data = await api.get(`/productos?${query.toString()}`);
      // Handle both old format (array) and new format ({ data, pagination })
      if (Array.isArray(data)) {
        setProductos(data);
      } else {
        setProductos(data.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filtros]);

  useEffect(() => {
    if (activeTab === 'listado') {
      fetchProductos();
    }
  }, [filtros.categoriaId, filtros.stockBajo, activeTab, fetchProductos]);

  // Debounce para búsqueda manual
  useEffect(() => {
    if (activeTab !== 'listado') return;
    const timer = setTimeout(() => {
      fetchProductos();
    }, 300);
    return () => clearTimeout(timer);
  }, [filtros.busqueda, fetchProductos, activeTab]);

  // ── LÓGICA DEL FORMULARIO INGRESO ──
  useEffect(() => {
    if (busquedaProdForm.trim().length >= 2) {
      const delay = setTimeout(async () => {
        try {
          const res = await api.get(`/productos?busqueda=${encodeURIComponent(busquedaProdForm.trim())}`);
          setSugerenciasProd(res.data);
        } catch (e) {
             console.error(e);
        }
      }, 300);
      return () => clearTimeout(delay);
    } else {
      setSugerenciasProd([]);
    }
  }, [busquedaProdForm]);

  const addProductoToIngreso = (prod) => {
    if (itemsIngreso.find(i => i.productoId === prod.id)) return;
    setItemsIngreso(prev => [...prev, { 
      productoId: prod.id, nombre: prod.nombre, 
      cantidad: 1, precioUnitario: "" 
    }]);
    setSugerenciasProd([]);
    setBusquedaProdForm('');
  };

  const quitarItemIngreso = (id) => {
    setItemsIngreso(prev => prev.filter(i => i.productoId !== id));
  };

  const updateItemIngreso = (id, field, val) => {
    setItemsIngreso(prev => prev.map(i => i.productoId === id ? { ...i, [field]: val } : i));
  };

  const handleIngresoSubmit = async (e) => {
    e.preventDefault();
    if (itemsIngreso.length === 0) {
      setFormError('Agrega al menos un producto al ingreso');
      return;
    }
    setFormError('');
    setSubmitting(true);
    try {
      const payload = {
        proveedorId: formIngreso.proveedorId || null,
        numeroRemito: formIngreso.numeroRemito,
        observaciones: formIngreso.observaciones,
        items: itemsIngreso.map(i => ({ 
           productoId: i.productoId, 
           cantidad: parseInt(i.cantidad, 10), 
           precioUnitario: i.precioUnitario === '' ? null : parseFloat(i.precioUnitario) 
        }))
      };
      await api.post('/stock/ingreso', payload);
      setFormSuccess('Ingreso de stock guardado exitosamente.');
      setTimeout(() => setFormSuccess(''), 3000);
      
      // Resetear
      setFormIngreso({ proveedorId: '', numeroRemito: '', observaciones: '' });
      setItemsIngreso([]);
      setBusquedaProdForm('');
    } catch (e) {
      if (e instanceof TypeError) {
        setFormError('Error de red');
      } else {
        setFormError(e.error || 'Error al guardar ingreso');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: C.bg, fontFamily: "'DM Mono', monospace" }}>
      
      {/* ── HEADER & TABS ── */}
      <div style={{ padding: "24px 32px 0 32px", borderBottom: `1px solid ${C.border}`, background: C.white }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text, marginBottom: 16 }}>Control de Stock</h1>
        
        <div style={{ display: "flex", gap: 16 }}>
          <button 
             onClick={() => setActiveTab('listado')} 
             style={{ 
               padding: "10px 16px", background: "none", border: "none", borderBottom: activeTab === 'listado' ? `3px solid ${C.accent}` : "3px solid transparent", 
               color: activeTab === 'listado' ? C.accent : C.textLight, fontWeight: 700, cursor: "pointer", fontSize: 13, transition: "color 0.15s" 
             }}
          >
            Vista de Inventario
          </button>
          {usuario?.rol === 'ADMIN' && (
            <button 
               onClick={() => setActiveTab('ingreso')} 
               style={{ 
                 padding: "10px 16px", background: "none", border: "none", borderBottom: activeTab === 'ingreso' ? `3px solid ${C.accent}` : "3px solid transparent", 
                 color: activeTab === 'ingreso' ? C.accent : C.textLight, fontWeight: 700, cursor: "pointer", fontSize: 13, transition: "color 0.15s" 
               }}
            >
              Nuevo Ingreso (Remito)
            </button>
          )}
        </div>
      </div>

      {/* ── CONTENIDO SCROLL ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: 32 }}>
        
        {/* =========================================================
             PESTAÑA 1: LISTADO Y ALERTAS
            ========================================================= */}
        {activeTab === 'listado' && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Filtros */}
            <div style={{ display: "flex", gap: 16, background: C.white, padding: 16, borderRadius: 0, border: `1px solid ${C.border}`, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 6 }}>BUSCAR POR NOMBRE O CÓDIGO</label>
                <input 
                  type="text" 
                  value={filtros.busqueda} onChange={e => setFiltros({ ...filtros, busqueda: e.target.value })}
                  placeholder="Ej: Aceite, 779..."
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 0, border: `1px solid ${C.border}`, outline: "none", fontFamily: "inherit", fontSize: 13 }}
                  onFocus={e => e.target.style.border = `1px solid ${C.accent}`}
                  onBlur={e => e.target.style.border = `1px solid ${C.border}`}
                />
              </div>
              <div style={{ width: 220 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 6 }}>CATEGORÍA</label>
                <select 
                   value={filtros.categoriaId} onChange={e => setFiltros({ ...filtros, categoriaId: e.target.value })}
                   style={{ width: "100%", padding: "10px 14px", borderRadius: 0, border: `1px solid ${C.border}`, outline: "none", fontFamily: "inherit", fontSize: 13, background: C.white }}
                >
                  <option value="">Todas las categorías</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "center", padding: "10px 0" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: C.textMid }}>
                  <input 
                    type="checkbox" 
                    checked={filtros.stockBajo} 
                    onChange={e => setFiltros({ ...filtros, stockBajo: e.target.checked })} 
                    style={{ accentColor: C.accent, width: 16, height: 16 }}
                  />
                  <span>Ver solo Stock Bajo</span>
                </label>
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
                    <th style={{ padding: "14px 20px", fontSize: 11, fontWeight: 600, color: C.textLight, textTransform: "uppercase", textAlign: "right" }}>Stock Actual</th>
                    <th style={{ padding: "14px 20px", fontSize: 11, fontWeight: 600, color: C.textLight, textTransform: "uppercase", textAlign: "right" }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                     <tr><td colSpan="5" style={{ padding: 24, textAlign: "center", color: C.textLight, fontSize: 13 }}>Cargando inventario...</td></tr>
                  ) : productos.length === 0 ? (
                    <tr><td colSpan="5" style={{ padding: 24, textAlign: "center", color: C.textLight, fontSize: 13 }}>No se encontraron productos</td></tr>
                  ) : (
                    productos.map((p, i) => {
                      const warning = p.stock <= (p.stockMinimo || 5);
                      return (
                        <tr key={p.id} style={{ borderBottom: i < productos.length - 1 ? `1px solid ${C.border}` : "none", transition: "background 0.1s" }}
                            onMouseEnter={e => e.currentTarget.style.background = "#F9FAFB"}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                        >
                          <td style={{ padding: "14px 20px", fontSize: 12, color: C.textLight, fontFamily: "'DM Mono', monospace" }}>{p.codigoBarras || "S/C"}</td>
                          <td style={{ padding: "14px 20px", fontSize: 13, fontWeight: 600, color: C.text }}>{p.nombre}</td>
                          <td style={{ padding: "14px 20px", fontSize: 12, color: C.textMid }}>{p.categoria?.nombre || p.categoria || "-"}</td>
                          <td style={{ padding: "14px 20px", fontSize: 14, fontWeight: 700, fontFamily: "'DM Mono', monospace", textAlign: "right", color: warning ? C.danger : C.text }}>
                            {p.stock}
                          </td>
                          <td style={{ padding: "14px 20px", textAlign: "right" }}>
                            {warning ? (
                              <span style={{ display: "inline-block", background: C.dangerBg, color: C.danger, padding: "4px 8px", borderRadius: 0, fontSize: 10, fontWeight: 700 }}>BAJO</span>
                            ) : (
                              <span style={{ display: "inline-block", background: C.accentBg, color: C.accent, padding: "4px 8px", borderRadius: 0, fontSize: 10, fontWeight: 700 }}>OK</span>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================================
             PESTAÑA 2: NUEVO INGRESO DE STOCK (Remito)
            ========================================================= */}
        {activeTab === 'ingreso' && (
          <div style={{ maxWidth: 800, margin: "0 auto", background: C.white, padding: 32, borderRadius: 0, border: `1px solid ${C.border}` }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 8 }}>Registrar Ingreso de Mercadería</h2>
            <p style={{ fontSize: 13, color: C.textLight, marginBottom: 24 }}>Carga facturas de proveedores, sumará automáticamente las cantidades listadas al stock actual.</p>
            
            {formSuccess && <div style={{ background: C.accentBg, color: C.accent, padding: 12, borderRadius: 0, fontSize: 13, marginBottom: 20, fontWeight: 600 }}>✓ {formSuccess}</div>}
            {formError && <div style={{ background: C.dangerBg, color: C.danger, padding: 12, borderRadius: 0, fontSize: 13, marginBottom: 20, fontWeight: 600 }}>⚠ {formError}</div>}
            
            <form onSubmit={handleIngresoSubmit}>
              {/* Encabezado del remito */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
                 <div>
                   <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 6 }}>PROVEEDOR (Opcional)</label>
                   <select 
                      value={formIngreso.proveedorId} onChange={e => setFormIngreso({ ...formIngreso, proveedorId: e.target.value })}
                      style={{ width: "100%", padding: "10px 14px", borderRadius: 0, border: `1px solid ${C.border}`, outline: "none", fontFamily: "inherit", fontSize: 13, background: C.white }}
                   >
                     <option value="">Seleccione proveedor...</option>
                     {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                   </select>
                 </div>
                 <div>
                   <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 6 }}>NÚMERO DE COMPROBANTE / REMITO</label>
                   <input 
                      type="text" 
                      value={formIngreso.numeroRemito} onChange={e => setFormIngreso({ ...formIngreso, numeroRemito: e.target.value })}
                      placeholder="Ej: 0001-00002341"
                      style={{ width: "100%", padding: "10px 14px", borderRadius: 0, border: `1px solid ${C.border}`, outline: "none", fontFamily: "inherit", fontSize: 13 }}
                      onFocus={e => e.target.style.border = `1px solid ${C.accent}`}
                      onBlur={e => e.target.style.border = `1px solid ${C.border}`}
                   />
                 </div>
              </div>

              {/* Búsqueda de Productos a Ingresar */}
              <div style={{ position: "relative", marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 6 }}>AÑADIR PRODUCTO A CARGAR</label>
                <input 
                   type="text" 
                   value={busquedaProdForm} onChange={e => setBusquedaProdForm(e.target.value)}
                   placeholder="Busca por nombre para cargar..."
                   style={{ width: "100%", padding: "12px 14px", borderRadius: 0, border: `2px solid ${C.border}`, outline: "none", fontFamily: "inherit", fontSize: 14 }}
                   onFocus={e => e.target.style.border = `2px solid ${C.blue}`}
                   onBlur={e => e.target.style.border = busquedaProdForm ? `2px solid ${C.blue}` : `2px solid ${C.border}`}
                />
                
                {/* Resultados FLOTANTES */}
                {sugerenciasProd.length > 0 && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: C.white, zIndex: 10, border: `1px solid ${C.border}`, borderRadius: 0, marginTop: 4, boxShadow: "none", maxHeight: 200, overflowY: "auto" }}>
                    {sugerenciasProd.map(p => (
                       <button 
                          key={p.id} type="button"
                          onClick={() => { addProductoToIngreso(p); }}
                          style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 16px", background: "transparent", border: "none", borderBottom: `1px solid ${C.border}`, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}
                          onMouseEnter={e => e.currentTarget.style.background = C.bg}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                       >
                         {p.nombre} — {p.codigoBarras}
                       </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Lista Seleccionada */}
              {itemsIngreso.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                   <div style={{ border: `1px solid ${C.border}`, borderRadius: 0, overflow: "hidden" }}>
                     <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                       <thead>
                         <tr style={{ background: "#F9FAFB", borderBottom: `1px solid ${C.border}` }}>
                            <th style={{ padding: "12px 16px", fontSize: 11, fontWeight: 600, color: C.textLight, textTransform: "uppercase" }}>Producto</th>
                            <th style={{ padding: "12px 16px", fontSize: 11, fontWeight: 600, color: C.textLight, textTransform: "uppercase", width: 120 }}>Cantidad a sumar</th>
                            <th style={{ padding: "12px 16px", fontSize: 11, fontWeight: 600, color: C.textLight, textTransform: "uppercase", width: 140 }}>Costo Unitario $</th>
                            <th style={{ padding: "12px 16px", fontSize: 11, fontWeight: 600, color: C.textLight, width: 40 }}>-</th>
                         </tr>
                       </thead>
                       <tbody>
                          {itemsIngreso.map(it => (
                             <tr key={it.productoId} style={{ borderBottom: `1px solid ${C.border}` }}>
                               <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: C.text }}>{it.nombre}</td>
                               <td style={{ padding: "8px 16px" }}>
                                 <input type="number" min="1" value={it.cantidad} onChange={e => updateItemIngreso(it.productoId, 'cantidad', e.target.value)} 
                                    style={{ width: "100%", padding: "6px", borderRadius: 0, border: `1px solid ${C.border}`, outline: "none", fontFamily: "'DM Mono', monospace", fontSize: 14 }}
                                 />
                               </td>
                               <td style={{ padding: "8px 16px" }}>
                                 <input type="number" min="0" step="0.01" value={it.precioUnitario} onChange={e => updateItemIngreso(it.productoId, 'precioUnitario', e.target.value)} 
                                    style={{ width: "100%", padding: "6px", borderRadius: 0, border: `1px solid ${C.border}`, outline: "none", fontFamily: "'DM Mono', monospace", fontSize: 14 }}
                                 />
                               </td>
                               <td style={{ padding: "12px 16px", textAlign: "right" }}>
                                 <button type="button" onClick={() => quitarItemIngreso(it.productoId)} style={{ background: "none", border: "none", color: C.textLight, cursor: "pointer", fontSize: 16 }}
                                    onMouseEnter={e => e.currentTarget.style.color = C.danger}
                                    onMouseLeave={e => e.currentTarget.style.color = C.textLight}
                                 >×</button>
                               </td>
                             </tr>
                          ))}
                       </tbody>
                     </table>
                   </div>
                </div>
              )}

              {/* Boton submit */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                 <button type="button" onClick={() => { setItemsIngreso([]); setFormIngreso({ proveedorId: '', numeroRemito: '', observaciones: '' }); }} style={{ padding: "12px 20px", borderRadius: 0, border: `1px solid ${C.border}`, background: C.white, cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}>Limpiar Formulario</button>
                 <button type="submit" disabled={submitting || itemsIngreso.length === 0} style={{ padding: "12px 24px", borderRadius: 0, border: "none", background: itemsIngreso.length === 0 ? "#D1D5DB" : C.accent, color: "#fff", cursor: itemsIngreso.length === 0 ? "not-allowed" : "pointer", fontWeight: 700, fontFamily: "inherit", transition: "all 0.2s" }}
                   onMouseEnter={e => { if(itemsIngreso.length > 0) e.currentTarget.style.background = C.accentHov }}
                   onMouseLeave={e => { if(itemsIngreso.length > 0) e.currentTarget.style.background = C.accent }}
                 >
                   Confirmar Ingreso y Sumar Stock
                 </button>
              </div>

            </form>
          </div>
        )}

      </div>
    </div>
  )
}
