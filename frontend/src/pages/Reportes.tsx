import { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { api } from '../lib/api';

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

// ── Respuestas de la API ──────────────────────────────────────

/** Fila de `prisma.venta.groupBy` en /reportes/ventas-hoy. */
interface VentaPorMetodoRow {
  metodoPago: string;
  _sum: { total: number | null };
  _count: { id: number };
}

/** Ticket reducido usado en la tabla "Últimos Tickets del Día". */
interface TicketReciente {
  id: number;
  fecha: string;
  total: number;
}

interface ReporteVentasHoy {
  totalVentas: number;
  totalDescuentos: number;
  cantidadTransacciones: number;
  ventasPorMetodo: VentaPorMetodoRow[];
  ultimasVentas: TicketReciente[];
}

/** Fila cruda de /reportes/ventas-por-dia ($queryRaw). */
interface VentaPorDiaRow {
  dia: string;
  cantidad_ventas: number;
  /** SUM() de Postgres llega como Decimal serializado. */
  total: string | number | null;
}

/** Fila de Recharts: `dia` abreviado y `total` ya numérico. */
interface VentaDiaria extends Omit<VentaPorDiaRow, 'total'> {
  diaCorto: string;
  total: number;
}

interface ProductoBajoStock {
  id: number;
  nombre: string;
  stock: number;
  stockMinimo: number;
  codigoBarras: string | null;
}

interface ReporteStock {
  totalProductos: number;
  /** El backend ya aplana el COUNT a número: `stockBajo[0]?.cantidad || 0`. */
  stockBajo: number;
  sinStock: number;
  productosBajoStock: ProductoBajoStock[];
}

const fmt = (num: number): string =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(num || 0);

/** `toISOString()` siempre trae la fecha al inicio; evita indexar un array. */
const isoDate = (d: Date): string => d.toISOString().slice(0, 10);

export default function Reportes() {
  const [loading, setLoading] = useState(true);

  // States para Reportes
  const [resumenHoy, setResumenHoy] = useState<ReporteVentasHoy | null>(null);
  const [ventasDiarias, setVentasDiarias] = useState<VentaDiaria[]>([]);
  const [reporteStock, setReporteStock] = useState<ReporteStock | null>(null);

  // Filtros
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  useEffect(() => {
    // defaults: ultimos 7 dias
    const d = new Date();
    d.setDate(d.getDate() - 7);
    setDesde(isoDate(d));
    setHasta(isoDate(new Date()));
  }, []);

  useEffect(() => {
    if (desde && hasta) {
      fetchReportes();
    }
  }, [desde, hasta]);

  const fetchReportes = async () => {
    setLoading(true);
    try {
      const p1 = api.get<ReporteVentasHoy | null>('/reportes/ventas-hoy').catch(() => null);
      const p2 = api.get<VentaPorDiaRow[]>(
        `/reportes/ventas-por-dia?desde=${desde}&hasta=${hasta}`
      ).catch((): VentaPorDiaRow[] => []);
      const p3 = api.get<ReporteStock | null>('/reportes/stock').catch(() => null);

      const [hoy, porDia, rStock] = await Promise.all([p1, p2, p3]);

      setResumenHoy(hoy);
      if (porDia) {
        // Formatear fechas para Recharts (ej "11 Mar")
        const fmtd: VentaDiaria[] = porDia.map(v => ({
          ...v,
          diaCorto: new Date(v.dia).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }),
          total: parseFloat(String(v.total ?? 0))
        }));
        setVentasDiarias(fmtd);
      }
      setReporteStock(rStock);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const porMetodo = resumenHoy?.ventasPorMetodo ?? [];
  const ultimasVentas = resumenHoy?.ultimasVentas ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: C.bg, fontFamily: "'DM Mono', monospace" }}>

      {/* ── HEADER ── */}
      <div style={{ padding: "32px 32px 24px 32px", borderBottom: `1px solid ${C.border}`, background: C.white, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text, marginBottom: 4 }}>Reportes y Metricas</h1>
          <p style={{ fontSize: 13, color: C.textLight }}>Visualiza el estado de las ventas e inventario del negocio.</p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 4 }}>Desde</label>
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={{ padding: "8px 12px", borderRadius: 0, border: `1px solid ${C.border}`, fontFamily: "inherit", outline: "none" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 4 }}>Hasta</label>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={{ padding: "8px 12px", borderRadius: 0, border: `1px solid ${C.border}`, fontFamily: "inherit", outline: "none" }} />
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: C.textMid }}>Generando reportes, por favor espera...</div>
      ) : (
        <div style={{ flex: 1, overflowY: "auto", padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>

          {/* ────── RESUMEN DEL DÍA ────── */}
          {resumenHoy && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
              <div style={{ background: C.white, padding: 20, borderRadius: 0, border: `1px solid ${C.border}`, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 4, background: C.accent }}></div>
                <div style={{ fontSize: 12, color: C.textLight, textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>Ventas de Hoy</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: C.text, fontFamily: "'DM Mono', monospace" }}>{fmt(resumenHoy.totalVentas)}</div>
              </div>

              <div style={{ background: C.white, padding: 20, borderRadius: 0, border: `1px solid ${C.border}`, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 4, background: C.blue }}></div>
                <div style={{ fontSize: 12, color: C.textLight, textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>Tickets Emitidos</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: C.text, fontFamily: "'DM Mono', monospace" }}>{resumenHoy.cantidadTransacciones}</div>
              </div>

              <div style={{ background: C.white, padding: 20, borderRadius: 0, border: `1px solid ${C.border}`, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 4, background: C.amber }}></div>
                <div style={{ fontSize: 12, color: C.textLight, textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>Descuentos Dados</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: C.text, fontFamily: "'DM Mono', monospace" }}>{fmt(resumenHoy.totalDescuentos)}</div>
              </div>

              <div style={{ background: C.white, padding: 20, borderRadius: 0, border: `1px solid ${C.border}`, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 4, background: C.danger }}></div>
                <div style={{ fontSize: 12, color: C.textLight, textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Alertas de Stock</div>
                {reporteStock && (
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.danger }}>{reporteStock.stockBajo} productos bajos</div>
                )}
              </div>
            </div>
          )}

          {/* ────── GRÁFICO HISTÓRICO VENTAS ────── */}
          <div style={{ background: C.white, borderRadius: 0, border: `1px solid ${C.border}`, padding: 24, minHeight: 400 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 32 }}>Evolución de Recaudación Diaria</h3>
            {ventasDiarias.length > 0 ? (
              <div style={{ width: "100%", height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={ventasDiarias} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={C.accent} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={C.accent} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.border} />
                    <XAxis dataKey="diaCorto" tick={{ fontSize: 12, fill: C.textMid, fontFamily: "'Sora'" }} axisLine={false} tickLine={false} dy={10} />
                    <YAxis tickFormatter={(num) => '$' + (num / 1000) + 'k'} tick={{ fontSize: 12, fill: C.textMid, fontFamily: "'Sora'" }} axisLine={false} tickLine={false} dx={-10} />
                    <Tooltip
                      formatter={(value) => [fmt(Number(value)), "Total Vendido"]}
                      labelStyle={{ fontWeight: 700, color: C.text, fontFamily: "'Sora'" }}
                      contentStyle={{ borderRadius: 0, border: `1px solid ${C.border}`, boxShadow: "none" }}
                    />
                    <Area type="monotone" dataKey="total" stroke={C.accent} strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 320, color: C.textLight }}>No hay ventas registradas en las fechas seleccionadas.</div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {/* ────── DESGLOSE DE MÉTODOS DE PAGO ────── */}
            <div style={{ background: C.white, borderRadius: 0, border: `1px solid ${C.border}`, padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 16 }}>Ventas por Método de Pago (Hoy)</h3>
              {porMetodo.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {porMetodo.map((v, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", background: C.bg, borderRadius: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{v.metodoPago} ({v._count.id} tickets)</span>
                      <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: C.accent }}>{fmt(v._sum.total ?? 0)}</span>
                    </div>
                  ))}
                </div>
              ) : <p style={{ fontSize: 13, color: C.textLight }}>Sin datos de métodos de pago hoy.</p>}
            </div>

            {/* ────── ÚLTIMOS TICKETS ────── */}
            <div style={{ background: C.white, borderRadius: 0, border: `1px solid ${C.border}`, padding: 24, maxHeight: 400, overflowY: "auto" }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 16 }}>Últimos Tickets del Día</h3>
              {ultimasVentas.length > 0 ? (
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      <th style={{ paddingBottom: 8, fontSize: 11, fontWeight: 600, color: C.textLight }}>HORA</th>
                      <th style={{ paddingBottom: 8, fontSize: 11, fontWeight: 600, color: C.textLight }}>TICKET #</th>
                      <th style={{ paddingBottom: 8, fontSize: 11, fontWeight: 600, color: C.textLight, textAlign: "right" }}>MONTO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ultimasVentas.slice(0, 10).map((v, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                        <td style={{ padding: "12px 0", fontSize: 13, color: C.textMid }}>{new Date(v.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</td>
                        <td style={{ padding: "12px 0", fontSize: 13, fontWeight: 600, color: C.text }}>{String(v.id).padStart(6, '0')}</td>
                        <td style={{ padding: "12px 0", fontSize: 14, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: C.text, textAlign: "right" }}>{fmt(v.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p style={{ fontSize: 13, color: C.textLight }}>No se han emitido tickets en el día de hoy.</p>}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}