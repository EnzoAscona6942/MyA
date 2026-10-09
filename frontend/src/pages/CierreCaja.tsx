import { useState, useEffect, type FormEvent } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { Caja, CajaCloseResponse, CajaResumen, MovimientoCaja } from '../types/api';

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

// Los campos `Decimal` de Prisma viajan como strings en el JSON; `format` los
// coacciona a número, así que la firma `number` no necesita cambios.
const fmt = (num: number): string =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(num || 0);

/**
 * `GET /caja/activa` responde la caja con `usuario: { nombre }` (select parcial,
 * no el usuario completo), el array de `movimientos` y los agregados
 * `totalVentas` / `cantidadVentas` calculados por la ruta.
 */
interface CajaActiva extends Omit<Caja, 'usuario'> {
  usuario?: { nombre: string };
  movimientos: MovimientoCaja[];
  totalVentas: number;
  cantidadVentas: number;
}

export default function CierreCaja() {
  const { cajaActiva, setCajaActiva } = useAuth();
  const [cajaData, setCajaData] = useState<CajaActiva | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Abrir caja
  const [montoInicial, setMontoInicial] = useState<string>('');

  // Cerrar caja
  const [montoReal, setMontoReal] = useState<string>('');
  const [observaciones, setObservaciones] = useState<string>('');

  // Movimiento manual
  const [tipoMov, setTipoMov] = useState<MovimientoCaja['tipo']>('INGRESO');
  const [montoMov, setMontoMov] = useState<string>('');
  const [descMov, setDescMov] = useState<string>('');
  const [showMov, setShowMov] = useState<boolean>(false);

  // States
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [cierreResult, setCierreResult] = useState<CajaResumen | null>(null);

  const fetchCaja = async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await api.get<CajaActiva>('/caja/activa');
      // Sin esta guarda, un null TYPEado como CajaActiva rompe en data.id y
      // el catch la convierte en "no hay caja abierta" tapando el error real.
      if (!data) {
        setCajaData(null);
        localStorage.removeItem('cajaId');
        return;
      }
      setCajaData(data);
      if (!cajaActiva) {
        setCajaActiva(data.id);
        localStorage.setItem('cajaId', String(data.id));
      }
    } catch {
      setCajaData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCaja();
  }, [cajaActiva]);

  const handleAbrir = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError('');
    try {
      const res = await api.post<Caja>('/caja/abrir', { montoInicial: parseFloat(montoInicial) });
      setCajaActiva(res.id);
      localStorage.setItem('cajaId', String(res.id));
      setSuccess("Caja abierta exitosamente");
      setTimeout(() => setSuccess(''), 3000);
      fetchCaja();
    } catch (e: unknown) {
      // El cliente de API lanza `ApiError` (objeto plano), no una `Error`.
      const err = e as { error?: string };
      setError(err.error || "Error al abrir la caja");
    }
  };

  const handleMovimiento = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError('');
    // Este form solo se monta con una caja activa, pero el tipo la ve nullable.
    const cajaId = cajaData?.id;
    if (cajaId === undefined) return;
    try {
      await api.post<MovimientoCaja>(`/caja/${cajaId}/movimiento`, {
        tipo: tipoMov,
        monto: parseFloat(montoMov),
        descripcion: descMov
      });
      setSuccess("Movimiento registrado");
      setShowMov(false);
      setMontoMov('');
      setDescMov('');
      setTimeout(() => setSuccess(''), 3000);
      fetchCaja(); // Refresh totals
    } catch (e: unknown) {
      // El cliente de API lanza `ApiError` (objeto plano), no una `Error`.
      const err = e as { error?: string };
      setError(err.error || "Error al registrar movimiento");
    }
  };

  const handleCerrar = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError('');
    // Este form solo se monta con una caja activa, pero el tipo la ve nullable.
    const cajaId = cajaData?.id;
    if (cajaId === undefined) return;
    try {
      const res = await api.post<CajaCloseResponse>(`/caja/${cajaId}/cerrar`, {
        montoFinalReal: parseFloat(montoReal),
        observaciones
      });
      setCierreResult(res.resumen);
      setCajaActiva(null);
      localStorage.removeItem('cajaId');
      setCajaData(null);
      setSuccess("Caja cerrada correctamente");
    } catch (e: unknown) {
      // El cliente de API lanza `ApiError` (objeto plano), no una `Error`.
      const err = e as { error?: string };
      setError(err.error || "Error al cerrar la caja");
    }
  };

  if (loading) return <div style={{ padding: 40, fontFamily: "'DM Mono', monospace" }}>Cargando caja...</div>;

  if (cierreResult) {
    return (
      <div style={{ padding: 40, background: C.bg, minHeight: '100%', fontFamily: "'DM Mono', monospace", width: "100%" }}>
        <div style={{ maxWidth: 600, margin: '0 auto', background: C.white, borderRadius: 0, padding: 32, boxShadow: "none" }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: C.accentBg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <span style={{ color: C.accent, fontSize: 32 }}>✓</span>
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text }}>Cierre de Caja Completado</h1>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            <div style={{ padding: 16, border: `1px solid ${C.border}`, borderRadius: 0 }}>
              <div style={{ fontSize: 13, color: C.textLight }}>Efectivo Esperado</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>{fmt(cierreResult.efectivoEsperado)}</div>
            </div>
            <div style={{ padding: 16, border: `1px solid ${C.border}`, borderRadius: 0 }}>
              <div style={{ fontSize: 13, color: C.textLight }}>Efectivo Contado</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>{fmt(cierreResult.montoFinalReal)}</div>
            </div>
          </div>
          <div style={{
            padding: 16, borderRadius: 0, textAlign: "center", marginBottom: 24,
            background: cierreResult.diferencia === 0 ? C.accentBg : (cierreResult.diferencia > 0 ? C.blueBg : C.dangerBg),
            color: cierreResult.diferencia === 0 ? C.accent : (cierreResult.diferencia > 0 ? C.blue : C.danger)
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>
              {cierreResult.diferencia === 0 ? "CAJA CUADRADA" : (cierreResult.diferencia > 0 ? "SOBRANTE" : "FALTANTE")}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>{fmt(cierreResult.diferencia)}</div>
          </div>
          <button onClick={() => setCierreResult(null)} style={{
            width: "100%", padding: "14px", borderRadius: 0, border: "none",
            background: C.text, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono', monospace",
          }}>Volver a Caja</button>
        </div>
      </div>
    );
  }

  // Si no hay caja de datos y no loading -> form de abrir caja
  if (!cajaData) {
    return (
      <div style={{ padding: 40, background: C.bg, minHeight: '100%', fontFamily: "'DM Mono', monospace", width: "100%" }}>
        <div style={{ maxWidth: 400, margin: '40px auto', background: C.white, borderRadius: 0, padding: 32, boxShadow: "none" }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: C.text }}>Abrir Turno</h1>
          <p style={{ fontSize: 13, color: C.textLight, marginBottom: 24 }}>Ingresa el dinero inicial en la caja chica.</p>

          {error && <div style={{ background: C.dangerBg, color: C.danger, padding: 12, borderRadius: 0, fontSize: 13, marginBottom: 16 }}>{error}</div>}

          <form onSubmit={handleAbrir}>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.textMid, marginBottom: 6 }}>Monto Inicial Efectivo ($)</label>
              <input
                type="number" min="0" required autoFocus
                value={montoInicial} onChange={e => setMontoInicial(e.target.value)}
                style={{ width: "100%", padding: "12px 14px", borderRadius: 0, border: `1px solid ${C.border}`, fontSize: 18, fontFamily: "'DM Mono', monospace", outline: "none" }}
                onFocus={e => e.target.style.border = `1px solid ${C.accent}`}
                onBlur={e => e.target.style.border = `1px solid ${C.border}`}
              />
            </div>
            <button type="submit" style={{
              width: "100%", padding: "14px", borderRadius: 0, border: "none",
              background: C.accent, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono', monospace"
            }}>Abrir Caja</button>
          </form>
        </div>
      </div>
    )
  }

  // Hay caja activa => mostrar dashboard y opción de cerrar
  return (
    <div style={{ padding: "32px 40px", background: C.bg, minHeight: '100%', fontFamily: "'DM Mono', monospace", width: "100%" }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text }}>Caja Activa</h1>
          <p style={{ fontSize: 13, color: C.textLight, marginTop: 4 }}>Abierta el {new Date(cajaData.fechaApertura).toLocaleString('es-AR')} por {cajaData.usuario?.nombre}</p>
        </div>
        <button onClick={() => setShowMov(true)} style={{
          padding: "10px 16px", borderRadius: 0, border: `1px solid ${C.border}`,
          background: C.white, color: C.textMid, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Mono', monospace",
          transition: "all 0.1s"
        }}>
          + Movimiento Manual
        </button>
      </div>

      {success && <div style={{ background: C.accentBg, color: C.accent, padding: 12, borderRadius: 0, fontSize: 13, marginBottom: 24, fontWeight: 600 }}>✓ {success}</div>}
      {error && <div style={{ background: C.dangerBg, color: C.danger, padding: 12, borderRadius: 0, fontSize: 13, marginBottom: 24 }}>⚠ {error}</div>}

      <div style={{ display: 'flex', gap: 24 }}>

        {/* Panel Izquierdo: Resumen y Movi */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Tarjetas resumen */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ background: C.white, padding: 20, borderRadius: 0, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 12, color: C.textLight, textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>Monto Inicial Efectivo</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.text, fontFamily: "'DM Mono', monospace" }}>{fmt(cajaData.montoInicial)}</div>
            </div>
            <div style={{ background: C.white, padding: 20, borderRadius: 0, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 12, color: C.textLight, textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>Total Facturado (Tickets: {cajaData.cantidadVentas})</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.text, fontFamily: "'DM Mono', monospace" }}>{fmt(cajaData.totalVentas)}</div>
            </div>
          </div>

          <div style={{ background: C.white, padding: 20, borderRadius: 0, border: `1px solid ${C.border}` }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 16 }}>Movimientos de Caja</h3>
            {cajaData.movimientos?.length === 0 ? (
              <div style={{ fontSize: 13, color: C.textLight, textAlign: "center", padding: "20px 0" }}>No hay movimientos manuales registrados en este turno.</div>
            ) : (
              cajaData.movimientos?.map(m => (
                <div key={m.id} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: `1px solid ${C.border}` }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{m.descripcion}</div>
                    <div style={{ fontSize: 11, color: C.textLight }}>{new Date(m.fecha).toLocaleTimeString('es-AR')}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: m.tipo === 'INGRESO' ? C.accent : C.danger, fontFamily: "'DM Mono', monospace" }}>
                    {m.tipo === 'INGRESO' ? '+' : '-'} {fmt(m.monto)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Panel Derecho: Cierre */}
        <div style={{ width: 340, background: C.white, borderRadius: 0, border: `1px solid ${C.border}`, padding: 24, height: "fit-content" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 8 }}>Cerrar Turno</h2>
          <p style={{ fontSize: 12, color: C.textLight, marginBottom: 24 }}>Contá el efectivo físico de la caja registradora e ingresalo aquí abajo para cuadrar.</p>

          <form onSubmit={handleCerrar}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.textMid, marginBottom: 6 }}>Efectivo en Cajón ($)</label>
              <input
                type="number" min="0" required
                value={montoReal} onChange={e => setMontoReal(e.target.value)}
                style={{ width: "100%", padding: "12px 14px", borderRadius: 0, border: `1px solid ${C.border}`, fontSize: 20, fontFamily: "'DM Mono', monospace", outline: "none", color: C.text }}
                onFocus={e => e.target.style.border = `1px solid ${C.accent}`}
                onBlur={e => e.target.style.border = `1px solid ${C.border}`}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.textMid, marginBottom: 6 }}>Observaciones (Opcional)</label>
              <textarea
                rows={3}
                value={observaciones} onChange={e => setObservaciones(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 0, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: "'DM Mono', monospace", outline: "none", resize: "none" }}
                onFocus={e => e.target.style.border = `1px solid ${C.accent}`}
                onBlur={e => e.target.style.border = `1px solid ${C.border}`}
              />
            </div>

            <button type="submit" disabled={!montoReal} style={{
              width: "100%", padding: "14px", borderRadius: 0, border: "none",
              background: montoReal ? C.accent : "#D1D5DB", color: "#fff", fontSize: 14, fontWeight: 700, cursor: montoReal ? "pointer" : "not-allowed", fontFamily: "'DM Mono', monospace", transition: "all 0.15s",
            }}
              onMouseEnter={e => { if (montoReal) e.currentTarget.style.background = C.accentHov; }}
              onMouseLeave={e => { if (montoReal) e.currentTarget.style.background = C.accent; }}
            >
              Confirmar Cierre
            </button>
          </form>
        </div>

      </div>

      {/* Modal Ingreso/Egreso */}
      {showMov && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: C.white, padding: 32, borderRadius: 0, width: 400 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Registrar Movimiento</h2>
            <form onSubmit={handleMovimiento}>
              <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                <button type="button" onClick={() => setTipoMov('INGRESO')} style={{ flex: 1, padding: 10, borderRadius: 0, border: `1px solid ${tipoMov === 'INGRESO' ? C.accent : C.border}`, background: tipoMov === 'INGRESO' ? C.accentBg : C.white, color: tipoMov === 'INGRESO' ? C.accent : C.textMid, fontWeight: 600, fontFamily: "inherit" }}>INGRESO</button>
                <button type="button" onClick={() => setTipoMov('EGRESO')} style={{ flex: 1, padding: 10, borderRadius: 0, border: `1px solid ${tipoMov === 'EGRESO' ? C.danger : C.border}`, background: tipoMov === 'EGRESO' ? C.dangerBg : C.white, color: tipoMov === 'EGRESO' ? C.danger : C.textMid, fontWeight: 600, fontFamily: "inherit" }}>EGRESO</button>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.textMid, marginBottom: 6 }}>Monto ($)</label>
                <input type="number" min="0" required value={montoMov} onChange={e => setMontoMov(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: 0, border: `1px solid ${C.border}`, fontFamily: "'DM Mono', monospace", fontSize: 16, outline: "none" }} />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.textMid, marginBottom: 6 }}>Motivo / Descripción</label>
                <input type="text" required value={descMov} onChange={e => setDescMov(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: 0, border: `1px solid ${C.border}`, fontFamily: "inherit", fontSize: 13, outline: "none" }} />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" onClick={() => setShowMov(false)} style={{ flex: 1, padding: 12, borderRadius: 0, border: `1px solid ${C.border}`, background: C.white, cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}>Cancelar</button>
                <button type="submit" disabled={!montoMov || !descMov} style={{ flex: 1, padding: 12, borderRadius: 0, border: "none", background: C.text, color: "#fff", cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}>Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}