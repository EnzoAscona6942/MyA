import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { Pagination, Venta, VentaListResponse } from '../types/api';

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

const fmt = (num: number): string =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(num || 0);
const fmtDate = (date: string): string =>
  new Date(date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/**
 * `<input type="date">` entrega "YYYY-MM-DD", pero el backend valida `from`/`to`
 * con `z.string().datetime()`, que rechaza fechas sin hora. Por eso se completa
 * el día completo: `from` arranca a las 00:00 y `to` termina a las 23:59:59.999
 * para no excluir las ventas del mismo día.
 */
const toIsoDateTime = (date: string, endOfDay: boolean): string =>
  `${date}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`;

const DEFAULT_PAGE_SIZE = 20;

export default function Ventas() {
  const { usuario } = useAuth();

  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  // Pagination
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
    total: 0,
    totalPages: 0
  });

  // Fetch ventas with pagination
  const fetchVentas = async (page = 1): Promise<void> => {
    setLoading(true);
    try {
      const skip = (page - 1) * DEFAULT_PAGE_SIZE;
      const query = new URLSearchParams();
      query.append('skip', skip.toString());
      query.append('take', DEFAULT_PAGE_SIZE.toString());

      if (fromDate) query.append('from', toIsoDateTime(fromDate, false));
      if (toDate) query.append('to', toIsoDateTime(toDate, true));

      const response = await api.get<VentaListResponse | Venta[]>(`/ventas?${query.toString()}`);

      // Handle both old format (array) and new format ({ data, pagination })
      if (Array.isArray(response)) {
        setVentas(response);
        setPagination({ page: 1, limit: DEFAULT_PAGE_SIZE, total: response.length, totalPages: response.length > 0 ? 1 : 0 });
      } else {
        setVentas(response.data || []);
        setPagination(response.pagination || { page: 1, limit: DEFAULT_PAGE_SIZE, total: 0, totalPages: 0 });
      }
    } catch (e: unknown) {
      // El cliente de API lanza `ApiError` (objeto plano), no una `Error`.
      console.error('Error al cargar ventas', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVentas();
  }, []);

  // Debounced filter change
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchVentas(1); // Reset to page 1 when filters change
    }, 300);
    return () => clearTimeout(timer);
  }, [fromDate, toDate]);

  // Handle pagination
  const handlePageChange = (newPage: number): void => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchVentas(newPage);
    }
  };

  if (usuario?.rol !== 'ADMIN') {
    return <div style={{ padding: 40, fontFamily: "'DM Mono', monospace" }}>Acceso restringido. Solo administradores.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: C.bg, fontFamily: "'DM Mono', monospace" }}>

      {/* ── HEADER ── */}
      <div style={{ padding: "32px 32px 24px 32px", borderBottom: `1px solid ${C.border}`, background: C.white }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text, marginBottom: 4 }}>Historial de Ventas</h1>
          <p style={{ fontSize: 13, color: C.textLight }}>Consulta y gestiona las ventas del sistema.</p>
        </div>
      </div>

      {/* ── FILTERS ── */}
      <div style={{ padding: "24px 32px 0" }}>
        <div style={{ display: "flex", gap: 16, background: C.white, padding: 16, borderRadius: 0, border: `1px solid ${C.border}`, alignItems: "flex-end" }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 6 }}>DESDE</label>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              style={{ padding: "10px 14px", borderRadius: 0, border: `1px solid ${C.border}`, outline: "none", fontFamily: "inherit", fontSize: 13 }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 6 }}>HASTA</label>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              style={{ padding: "10px 14px", borderRadius: 0, border: `1px solid ${C.border}`, outline: "none", fontFamily: "inherit", fontSize: 13 }}
            />
          </div>
          <button
            onClick={() => { setFromDate(''); setToDate(''); }}
            style={{
              padding: "10px 16px",
              borderRadius: 0,
              border: `1px solid ${C.border}`,
              background: C.white,
              color: C.textMid,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Limpiar
          </button>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>

        {/* Table */}
        <div style={{ background: C.white, borderRadius: 0, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#F9FAFB", borderBottom: `1px solid ${C.border}` }}>
                <th style={{ padding: "14px 20px", fontSize: 11, fontWeight: 600, color: C.textLight, textTransform: "uppercase" }}>ID</th>
                <th style={{ padding: "14px 20px", fontSize: 11, fontWeight: 600, color: C.textLight, textTransform: "uppercase" }}>Fecha</th>
                <th style={{ padding: "14px 20px", fontSize: 11, fontWeight: 600, color: C.textLight, textTransform: "uppercase" }}>Usuario</th>
                <th style={{ padding: "14px 20px", fontSize: 11, fontWeight: 600, color: C.textLight, textTransform: "uppercase", textAlign: "right" }}>Items</th>
                <th style={{ padding: "14px 20px", fontSize: 11, fontWeight: 600, color: C.textLight, textTransform: "uppercase", textAlign: "right" }}>Total</th>
                <th style={{ padding: "14px 20px", fontSize: 11, fontWeight: 600, color: C.textLight, textTransform: "uppercase" }}>Método</th>
                <th style={{ padding: "14px 20px", fontSize: 11, fontWeight: 600, color: C.textLight, textTransform: "uppercase" }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: C.textLight, fontSize: 13 }}>Cargando datos...</td></tr>
              ) : ventas.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: C.textLight, fontSize: 13 }}>No se encontraron ventas.</td></tr>
              ) : (
                ventas.map((v, i) => (
                  <tr key={v.id} style={{ borderBottom: i < ventas.length - 1 ? `1px solid ${C.border}` : "none", transition: "background 0.1s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#F9FAFB"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={{ padding: "14px 20px", fontSize: 12, fontWeight: 600, color: C.text }}>#{v.id}</td>
                    <td style={{ padding: "14px 20px", fontSize: 12, color: C.textMid }}>{fmtDate(v.fecha)}</td>
                    <td style={{ padding: "14px 20px", fontSize: 12, color: C.textMid }}>{v.usuario?.nombre || '-'}</td>
                    <td style={{ padding: "14px 20px", fontSize: 12, color: C.textMid, textAlign: "right" }}>{v.items?.length || 0}</td>
                    <td style={{ padding: "14px 20px", fontSize: 14, fontWeight: 700, fontFamily: "'DM Mono', monospace", textAlign: "right", color: C.text }}>{fmt(v.total)}</td>
                    <td style={{ padding: "14px 20px", fontSize: 12, color: C.textMid }}>{v.metodoPago}</td>
                    <td style={{ padding: "14px 20px" }}>
                      <span style={{
                        padding: "4px 8px",
                        borderRadius: 0,
                        fontSize: 11,
                        fontWeight: 600,
                        background: v.estado === 'COMPLETADA' ? C.accentBg : v.estado === 'ANULADA' ? C.dangerBg : C.amberBg,
                        color: v.estado === 'COMPLETADA' ? C.accent : v.estado === 'ANULADA' ? C.danger : C.amber
                      }}>
                        {v.estado}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── PAGINATION CONTROLS ── */}
        {pagination.totalPages > 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", marginTop: 16, borderTop: `1px solid ${C.border}`, background: C.white }}>
            <div style={{ fontSize: 13, color: C.textMid }}>
              Mostrando <strong>{(pagination.page - 1) * pagination.limit + 1}</strong> - <strong>{Math.min(pagination.page * pagination.limit, pagination.total)}</strong> de <strong>{pagination.total}</strong> ventas
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
    </div>
  );
}
