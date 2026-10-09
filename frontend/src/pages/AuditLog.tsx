import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { Pagination } from '../types/api';

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

const fmtDate = (date: string): string =>
  new Date(date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const DEFAULT_PAGE_SIZE = 20;

// ── Respuestas de la API ───────────────────────────────────────

/** `enum AccionAuditLog` de `backend/prisma/schema.prisma`. */
type AccionAuditLog =
  | 'CREATE'
  | 'READ'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'EXPORT'
  | 'OTHER';

/** Fila de `prisma.auditLog.findMany` en GET /api/audit. */
interface AuditLogEntry {
  id: number;
  action: AccionAuditLog;
  resource: string;
  resourceId: number | null;
  details: string | null;
  ipAddress: string | null;
  usuarioId: number | null;
  /** El backend hace `include.usuario.select { id, nombre, email }`. */
  usuario?: { id: number; nombre: string; email: string } | null;
  creadoEn: string;
}

/**
 * GET /api/audit devuelve la metadata de paginación en `meta`
 * (`{ total, page, limit, totalPages }`), NO en `pagination`.
 */
interface AuditListResponse {
  data: AuditLogEntry[];
  meta: Pagination;
}

interface ActionStyle {
  bg: string;
  color: string;
}

/** Color para acciones fuera del enum conocido; se usa como fallback de la tabla. */
const FALLBACK_ACTION_STYLE: ActionStyle = { bg: '#F1F5F9', color: '#64748B' };

const ACTION_COLORS: Record<string, ActionStyle> = {
  CREATE: { bg: '#DCFCE7', color: '#16A34A' },
  READ: { bg: '#DBEAFE', color: '#2563EB' },
  UPDATE: { bg: '#FEF3C7', color: '#D97706' },
  DELETE: { bg: '#FEE2E2', color: '#DC2626' },
  LOGIN: { bg: '#F3E8FF', color: '#9333EA' },
  LOGOUT: { bg: '#F3E8FF', color: '#9333EA' },
  EXPORT: { bg: '#E0E7FF', color: '#4F46E5' },
  OTHER: FALLBACK_ACTION_STYLE
};

export default function AuditLog() {
  const { usuario } = useAuth();

  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [action, setAction] = useState<string>('');
  const [resource, setResource] = useState<string>('');

  // Pagination
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
    total: 0,
    totalPages: 0
  });

  // Fetch audit logs with pagination
  const fetchAuditLogs = async (page = 1): Promise<void> => {
    setLoading(true);
    try {
      // El backend pagina con `page`/`limit`; `skip`/`take` los ignora.
      const query = new URLSearchParams();
      query.append('page', page.toString());
      query.append('limit', DEFAULT_PAGE_SIZE.toString());

      if (action) query.append('action', action);
      if (resource) query.append('resource', resource);

      const response = await api.get<AuditListResponse | AuditLogEntry[]>(`/audit?${query.toString()}`);

      if (Array.isArray(response)) {
        setAuditLogs(response);
        setPagination({ page: 1, limit: DEFAULT_PAGE_SIZE, total: response.length, totalPages: response.length > 0 ? 1 : 0 });
      } else {
        setAuditLogs(response.data || []);
        setPagination(response.meta || { page: 1, limit: DEFAULT_PAGE_SIZE, total: 0, totalPages: 0 });
      }
    } catch (e: unknown) {
      // El cliente de API lanza `ApiError` (objeto plano), no una `Error`.
      console.error('Error al cargar logs de auditoría', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  // Debounced filter change
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAuditLogs(1); // Reset to page 1 when filters change
    }, 300);
    return () => clearTimeout(timer);
  }, [action, resource]);

  // Handle pagination
  const handlePageChange = (newPage: number): void => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchAuditLogs(newPage);
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
          <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text, marginBottom: 4 }}>Log de Auditoría</h1>
          <p style={{ fontSize: 13, color: C.textLight }}>Registro de acciones realizadas en el sistema.</p>
        </div>
      </div>

      {/* ── FILTERS ── */}
      <div style={{ padding: "24px 32px 0" }}>
        <div style={{ display: "flex", gap: 16, background: C.white, padding: 16, borderRadius: 0, border: `1px solid ${C.border}`, alignItems: "flex-end" }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 6 }}>ACCIÓN</label>
            <select
              value={action}
              onChange={e => setAction(e.target.value)}
              style={{ padding: "10px 14px", borderRadius: 0, border: `1px solid ${C.border}`, outline: "none", fontFamily: "inherit", fontSize: 13, background: C.white, minWidth: 150 }}
            >
              <option value="">Todas las acciones</option>
              <option value="CREATE">Crear</option>
              <option value="READ">Leer</option>
              <option value="UPDATE">Actualizar</option>
              <option value="DELETE">Eliminar</option>
              <option value="LOGIN">Login</option>
              <option value="LOGOUT">Logout</option>
              <option value="EXPORT">Exportar</option>
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 6 }}>RECURSO</label>
            <select
              value={resource}
              onChange={e => setResource(e.target.value)}
              style={{ padding: "10px 14px", borderRadius: 0, border: `1px solid ${C.border}`, outline: "none", fontFamily: "inherit", fontSize: 13, background: C.white, minWidth: 150 }}
            >
              <option value="">Todos los recursos</option>
              <option value="usuarios">Usuarios</option>
              <option value="productos">Productos</option>
              <option value="ventas">Ventas</option>
              <option value="caja">Caja</option>
              <option value="auth">Autenticación</option>
            </select>
          </div>
          <button
            onClick={() => { setAction(''); setResource(''); }}
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
                <th style={{ padding: "14px 20px", fontSize: 11, fontWeight: 600, color: C.textLight, textTransform: "uppercase" }}>Fecha</th>
                <th style={{ padding: "14px 20px", fontSize: 11, fontWeight: 600, color: C.textLight, textTransform: "uppercase" }}>Usuario</th>
                <th style={{ padding: "14px 20px", fontSize: 11, fontWeight: 600, color: C.textLight, textTransform: "uppercase" }}>Acción</th>
                <th style={{ padding: "14px 20px", fontSize: 11, fontWeight: 600, color: C.textLight, textTransform: "uppercase" }}>Recurso</th>
                <th style={{ padding: "14px 20px", fontSize: 11, fontWeight: 600, color: C.textLight, textTransform: "uppercase" }}>ID Recurso</th>
                <th style={{ padding: "14px 20px", fontSize: 11, fontWeight: 600, color: C.textLight, textTransform: "uppercase" }}>Detalles</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: C.textLight, fontSize: 13 }}>Cargando datos...</td></tr>
              ) : auditLogs.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: C.textLight, fontSize: 13 }}>No se encontraron registros.</td></tr>
              ) : (
                auditLogs.map((log, i) => {
                  const actionStyle = ACTION_COLORS[log.action] || FALLBACK_ACTION_STYLE;
                  return (
                    <tr key={log.id} style={{ borderBottom: i < auditLogs.length - 1 ? `1px solid ${C.border}` : "none", transition: "background 0.1s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#F9FAFB"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <td style={{ padding: "14px 20px", fontSize: 12, color: C.textMid }}>{fmtDate(log.creadoEn)}</td>
                      <td style={{ padding: "14px 20px", fontSize: 12, color: C.textMid }}>{log.usuario?.nombre || 'Sistema'}</td>
                      <td style={{ padding: "14px 20px" }}>
                        <span style={{
                          padding: "4px 8px",
                          borderRadius: 0,
                          fontSize: 11,
                          fontWeight: 600,
                          background: actionStyle.bg,
                          color: actionStyle.color
                        }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ padding: "14px 20px", fontSize: 12, color: C.textMid, textTransform: "capitalize" }}>{log.resource}</td>
                      <td style={{ padding: "14px 20px", fontSize: 12, color: C.textLight }}>{log.resourceId || '-'}</td>
                      <td style={{ padding: "14px 20px", fontSize: 11, color: C.textLight, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={log.details ?? undefined}>
                        {log.details || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── PAGINATION CONTROLS ── */}
        {pagination.totalPages > 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", marginTop: 16, borderTop: `1px solid ${C.border}`, background: C.white }}>
            <div style={{ fontSize: 13, color: C.textMid }}>
              Mostrando <strong>{(pagination.page - 1) * pagination.limit + 1}</strong> - <strong>{Math.min(pagination.page * pagination.limit, pagination.total)}</strong> de <strong>{pagination.total}</strong> registros
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
