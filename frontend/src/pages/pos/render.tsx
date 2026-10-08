// ============================================================
// POS - RENDER & MAIN APP
// ============================================================

import { useState } from 'react';
import { C, NAV_ITEMS, METODOS_PAGO, fmt, now, type CartItem, type VentaFront, type ModalType, type MetodoPago } from './index';
import { Sidebar, ModalPago, TicketVenta, ModuloPendiente } from './components';
import { usePOSLogic } from './logic';
import Stock from '../Stock';
import Reportes from '../Reportes';
import type { FC, ChangeEvent, KeyboardEvent, FocusEvent, MouseEvent } from 'react';

// ============================================================
// POS COMPONENT
// ============================================================

export const POS: FC = () => {
  const logic = usePOSLogic();

  return (
    <div style={{ display: 'flex', height: '100vh', gap: 0 }}>

      {/* ── Panel izquierdo: búsqueda + productos ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px 20px 24px 24px', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: C.text, letterSpacing: '-0.4px' }}>Punto de Venta</h1>
            <p style={{ fontSize: 12, color: C.textLight, marginTop: 2 }}>Escaneá o buscá un producto para agregar</p>
          </div>
          {/* Indicador de scanner */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
            background: logic.scanning ? C.accentBg : C.white,
            border: '1px solid ' + (logic.scanning ? C.accent : C.border),
            borderRadius: 0, transition: 'all 0.2s',
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: logic.scanning ? C.accent : '#D1D5DB',
              transition: 'all 0.2s',
              ...(logic.scanning ? { animation: 'scanPulse 0.4s ease' } : {}),
            }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: logic.scanning ? C.accent : C.textLight }}>
              {logic.scanning ? 'Leyendo...' : 'Scanner listo'}
            </span>
          </div>
        </div>

        {/* Barra de búsqueda */}
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={C.textLight} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <input
            ref={logic.searchRef}
            type="text"
            value={logic.busqueda}
            onChange={e => logic.setBusqueda(e.target.value)}
            onKeyDown={logic.handleSearchKeyDown}
            placeholder="Buscar por nombre o escanear código de barras..."
            autoFocus
            style={{
              width: '100%', padding: '12px 16px 12px 42px',
              border: '1px solid ' + C.border, borderRadius: 0,
              fontSize: 14, fontFamily: "'DM Mono', monospace",
              outline: 'none', background: C.white, color: C.text,
              transition: 'border 0.15s',
            }}
            onFocus={e => e.currentTarget.style.border = '1px solid ' + C.accent}
            onBlur={e => e.currentTarget.style.border = '1px solid ' + C.border}
          />
          {logic.busqueda && (
            <button onClick={() => logic.setBusqueda('')} style={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: C.textLight,
              fontSize: 18, lineHeight: 1,
            }}>×</button>
          )}
        </div>

        {/* Error */}
        {logic.error && (
          <div style={{
            padding: '10px 14px', background: C.dangerBg, borderRadius: 0,
            color: C.danger, fontSize: 13, fontWeight: 500, marginBottom: 12,
            border: '1px solid #FECACA', animation: 'slideIn 0.2s ease',
          }}>
            ⚠ {logic.error}
          </div>
        )}

        {/* Resultados de búsqueda */}
        {logic.productosFiltrados.length > 0 && (
          <div style={{
            background: C.white, border: '1px solid ' + C.border, borderRadius: 0,
            overflow: 'hidden', marginBottom: 16, boxShadow: 'none',
          }}>
            {logic.productosFiltrados.map((p, i) => (
              <button key={p.id} onClick={() => { logic.agregarAlCarrito(p); logic.setBusqueda(''); }} style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '11px 16px', border: 'none', background: C.white, cursor: 'pointer',
                borderTop: i > 0 ? '1px solid ' + C.border : 'none',
                transition: 'background 0.1s', textAlign: 'left',
                fontFamily: "'DM Mono', monospace",
              }}
                onMouseEnter={e => e.currentTarget.style.background = C.bg}
                onMouseLeave={e => e.currentTarget.style.background = C.white}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{p.nombre}</div>
                  <div style={{ fontSize: 11, color: C.textLight, marginTop: 1 }}>{p.codigoBarras} · {p.categoria?.nombre || '-'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.accent, fontFamily: "'DM Mono', monospace" }}>{fmt(p.precio)}</div>
                  <div style={{ fontSize: 11, color: p.stock <= 5 ? C.danger : C.textLight }}>Stock: {p.stock}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Accesos rápidos cuando no hay búsqueda */}
        {!logic.busqueda && (
          <>
            <p style={{ fontSize: 11, fontWeight: 600, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
              Productos frecuentes
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, overflowY: 'auto' }}>
              {logic.frecuentes.map(p => (
                <button key={p.id} onClick={() => logic.agregarAlCarrito(p)} style={{
                  padding: '12px 14px', borderRadius: 0, border: '1px solid ' + C.border,
                  background: C.white, cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.15s', fontFamily: "'DM Mono', monospace",
                }}
                  onMouseEnter={e => { e.currentTarget.style.border = '1px solid ' + C.accent; e.currentTarget.style.background = C.accentBg; }}
                  onMouseLeave={e => { e.currentTarget.style.border = '1px solid ' + C.border; e.currentTarget.style.background = C.white; }}
                >
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 4, lineHeight: 1.3 }}>{p.nombre}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.accent, fontFamily: "'DM Mono', monospace" }}>{fmt(p.precio)}</span>
                    <span style={{ fontSize: 10, color: C.textLight }}>×{p.stock}</span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

      </div>

      {/* ── Panel derecho: carrito ── */}
      <div style={{
        width: 340, background: C.white, display: 'flex', flexDirection: 'column',
        borderLeft: '1px dashed ' + C.border, height: '100vh',
        boxShadow: 'none',
      }}>

        {/* Header carrito */}
        <div style={{ padding: '24px 20px 16px', borderBottom: '1px dashed ' + C.border }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
              Carrito
              {logic.carrito.length > 0 && (
                <span style={{
                  marginLeft: 8, background: C.accent, color: '#fff',
                  borderRadius: 0, padding: '1px 8px', fontSize: 11, fontWeight: 600,
                }}>
                  {logic.carrito.reduce((a, i) => a + i.cantidad, 0)}
                </span>
              )}
            </h2>
            {logic.carrito.length > 0 && (
              <button onClick={() => logic.setCarrito([])} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 11, color: C.danger, fontWeight: 600,
                fontFamily: "'DM Mono', monospace",
              }}>
                Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Items del carrito */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
          {logic.carrito.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center' }}>
              <div style={{ marginBottom: 12, opacity: 0.3 }}>
                <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke={C.textLight} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 5v14M7 5v14M11 5v14M15 5v14M19 5v14M3 5h2M3 19h2M19 5h2M19 19h2" />
                </svg>
              </div>
              <p style={{ fontSize: 13, color: C.textLight, lineHeight: 1.5 }}>
                Escaneá un producto<br />o buscalo arriba
              </p>
            </div>
          ) : (
            logic.carrito.map(item => (
              <div key={item.id} className="item-enter" style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 8px', borderRadius: 0, marginBottom: 4,
                background: logic.flashId === item.id ? C.accentBg : 'transparent',
                transition: 'background 0.3s',
              }}>
                {/* Info producto */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.text, lineHeight: 1.3, marginBottom: 2 }}>
                    {item.nombre}
                  </div>
                  <div style={{ fontSize: 11, color: C.textLight, fontFamily: "'DM Mono', monospace" }}>
                    {fmt(item.precio)} c/u
                  </div>
                </div>

                {/* Controles cantidad */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button onClick={() => logic.cambiarCantidad(item.id, -1)} style={{
                    width: 24, height: 24, borderRadius: 0, border: '1px solid ' + C.border,
                    background: C.white, cursor: 'pointer', fontSize: 14, color: C.textMid,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                  }}>−</button>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.text, minWidth: 20, textAlign: 'center', fontFamily: "'DM Mono', monospace" }}>
                    {item.cantidad}
                  </span>
                  <button onClick={() => logic.cambiarCantidad(item.id, 1)} style={{
                    width: 24, height: 24, borderRadius: 0, border: '1px solid ' + C.border,
                    background: C.white, cursor: 'pointer', fontSize: 14, color: C.textMid,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                  }}>+</button>
                </div>

                {/* Subtotal */}
                <div style={{ textAlign: 'right', minWidth: 64 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text, fontFamily: "'DM Mono', monospace" }}>
                    {fmt(item.precio * item.cantidad)}
                  </div>
                  <button onClick={() => logic.quitarItem(item.id)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: C.textLight, padding: '2px 0', marginTop: 2,
                    display: 'flex', alignItems: 'center', justifyContent: 'flex-end', width: '100%',
                  }}
                    onMouseEnter={e => e.currentTarget.style.color = C.danger}
                    onMouseLeave={e => e.currentTarget.style.color = C.textLight}
                  >
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer: descuento + totales + cobrar */}
        <div style={{ borderTop: '1px dashed ' + C.border, padding: '16px 20px' }}>

          {/* Descuento */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: C.textMid, fontWeight: 500, whiteSpace: 'nowrap' }}>Descuento $</label>
            <input
              type="number"
              value={logic.descuento || ''}
              onChange={logic.handleDescuentoChange}
              placeholder="0"
              min="0"
              style={{
                flex: 1, padding: '7px 10px', border: '1px solid ' + C.border,
                borderRadius: 0, fontSize: 13, fontFamily: "'DM Mono', monospace",
                outline: 'none', color: C.text,
              }}
              onFocus={logic.handleMontoFocus}
              onBlur={logic.handleMontoBlur}
            />
          </div>

          {/* Subtotal */}
          {logic.descuento > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: C.textMid }}>Subtotal</span>
              <span style={{ fontSize: 12, color: C.textMid, fontFamily: "'DM Mono', monospace" }}>{fmt(logic.subtotal)}</span>
            </div>
          )}
          {logic.descuento > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: C.amber }}>Descuento</span>
              <span style={{ fontSize: 12, color: C.amber, fontFamily: "'DM Mono', monospace" }}>− {fmt(logic.descuento)}</span>
            </div>
          )}

          {/* Total */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 14px', background: logic.carrito.length > 0 ? C.accentBg : C.bg,
            borderRadius: 0, marginBottom: 12, transition: 'background 0.3s',
          }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>TOTAL</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: logic.carrito.length > 0 ? C.accent : C.textLight, fontFamily: "'DM Mono', monospace" }}>
              {fmt(logic.total)}
            </span>
          </div>

          {/* Botón cobrar */}
          <button
            onClick={() => logic.carrito.length > 0 && logic.setModal('pago')}
            disabled={logic.carrito.length === 0}
            style={{
              width: '100%', padding: '14px', borderRadius: 0, border: 'none',
              background: logic.carrito.length > 0 ? C.accent : 'transparent',
              color: logic.carrito.length > 0 ? C.text : C.textLight,
              borderTop: '1px dashed ' + C.border,
              borderBottom: '1px dashed ' + C.border,
              fontSize: 15, fontWeight: 700, cursor: logic.carrito.length > 0 ? 'pointer' : 'not-allowed',
              fontFamily: "'DM Mono', monospace", transition: 'all 0.2s',
              letterSpacing: '-0.2px',
            }}
            onMouseEnter={e => { if (logic.carrito.length > 0) e.currentTarget.style.background = C.accentHov; }}
            onMouseLeave={e => { if (logic.carrito.length > 0) e.currentTarget.style.background = C.accent; }}
          >
            Cobrar {logic.carrito.length > 0 ? fmt(logic.total) : ''}
          </button>
        </div>
      </div>

      {/* Modales */}
      {logic.modal === 'pago' && (
        <ModalPago
          total={logic.total}
          descuento={logic.descuento}
          onConfirm={logic.handleConfirmarPago}
          onClose={logic.handleCloseModal}
        />
      )}
      {logic.modal === 'ticket' && logic.ventaExitosa && (
        <TicketVenta venta={logic.ventaExitosa} onNuevaVenta={logic.handleNuevaVenta} />
      )}
    </div>
  );
};

// ============================================================
// MAIN APP
// ============================================================

export default function MainApp() {
  const [activeModule, setActiveModule] = useState('pos');

  const renderModule = () => {
    switch (activeModule) {
      case 'pos': return <POS />;
      case 'stock': return <Stock />;
      case 'caja': return <ModuloPendiente nombre="Cierre de Caja" />;
      case 'productos': return <ModuloPendiente nombre="Productos" />;
      case 'reportes': return <Reportes />;
      case 'ventas': return <ModuloPendiente nombre="Ventas" />;
      case 'usuarios': return <ModuloPendiente nombre="Usuarios" />;
      case 'audit': return <ModuloPendiente nombre="Auditoría" />;
      default: return <POS />;
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      <Sidebar activeModule={activeModule} setActiveModule={setActiveModule} />
      <main style={{ marginLeft: 220, flex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {renderModule()}
      </main>
    </div>
  );
}