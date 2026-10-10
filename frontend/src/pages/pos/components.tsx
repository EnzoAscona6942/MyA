// ============================================================
// POS - COMPONENTS
// ============================================================

import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { C, FS, FONT, NAV_ITEMS, METODOS_PAGO, fmt, now, type MetodoPago, type VentaFront } from './types';
import { iconMap } from './icons';
import type { FC } from 'react';

// ============================================================
// SIDEBAR
// ============================================================

interface SidebarProps {
  activeModule: string;
  setActiveModule: (id: string) => void;
}

export const Sidebar: FC<SidebarProps> = ({ activeModule, setActiveModule }) => {
  const { usuario, logout } = useAuth();

  return (
    <aside style={{
      width: 220, minHeight: '100vh', background: C.sidebar,
      display: 'flex', flexDirection: 'column',
      position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ padding: '28px 24px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 0,
            background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: FS.md, fontFamily: FONT.sans }}>M</span>
          </div>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: FS.base, letterSpacing: '-0.3px' }}>MyA</div>
            <div style={{ color: '#6B7280', fontSize: FS.xs, fontWeight: 400, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Minimercado</div>
          </div>
        </div>
      </div>

      {/* Fecha */}
      <div style={{ padding: '0 16px 20px' }}>
        <div style={{
          background: 'rgba(255,255,255,0.05)', borderRadius: 0, padding: '8px 12px',
        }}>
          <div style={{ color: '#9CA3AF', fontSize: FS.xs, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '0 12px' }}>
        <div style={{ color: '#4B5563', fontSize: FS.xs, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', padding: '0 8px 8px' }}>Módulos</div>
        {NAV_ITEMS.map(({ id, label, iconName }) => {
          const active = activeModule === id;
          const Icon = iconMap[iconName as keyof typeof iconMap];
          return (
            <button
              key={id}
              onClick={() => setActiveModule(id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 0, border: 'none', cursor: 'pointer',
                marginBottom: 2, transition: 'all 0.15s',
                background: active ? 'rgba(22,163,74,0.15)' : 'transparent',
                color: active ? C.accent : '#9CA3AF',
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#fff'; } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9CA3AF'; } }}
            >
              <Icon size={16} color="currentColor" />
              <span style={{ fontSize: FS.sm, fontWeight: active ? 600 : 400 }}>{label}</span>
              {active && <div style={{ marginLeft: 'auto', width: 5, height: 5, borderRadius: '50%', background: C.accent }} />}
            </button>
          );
        })}
      </nav>

      {/* Usuario */}
      <div style={{ padding: '16px 12px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px' }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: `linear-gradient(135deg, #16A34A, ${C.accentHov})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: '#fff', fontSize: FS.sm, fontWeight: 600 }}>
              {usuario?.nombre?.substring(0, 2).toUpperCase() || 'US'}
            </span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#F9FAFB', fontSize: FS.sm, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {usuario?.nombre || 'Usuario'}
            </div>
            <div style={{ color: '#6B7280', fontSize: FS.xs }}>{usuario?.rol || 'Rol'}</div>
          </div>
          <button onClick={logout} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', padding: 4 }}
            onMouseEnter={e => e.currentTarget.style.color = C.danger}
            onMouseLeave={e => e.currentTarget.style.color = '#6B7280'}
          >
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
};

// ============================================================
// MODAL PAGO
// ============================================================

interface ModalPagoProps {
  total: number;
  descuento: number;
  onConfirm: (data: { metodo: MetodoPago; montoRecibido: number; vuelto: number }) => void;
  onClose: () => void;
}

export const ModalPago: FC<ModalPagoProps> = ({ total, descuento, onConfirm, onClose }) => {
  const [metodo, setMetodo] = useState<MetodoPago>('EFECTIVO');
  const [recibido, setRecibido] = useState('');
  const vuelto = metodo === 'EFECTIVO' && recibido ? parseFloat(recibido) - total : null;
  const puedeConfirmar = metodo !== 'EFECTIVO' || (recibido && parseFloat(recibido) >= total);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      animation: 'fadeIn 0.15s ease',
    }}>
      <div style={{
        background: C.white, borderRadius: 0, width: 420, padding: 32,
        boxShadow: 'none',
        animation: 'slideIn 0.2s ease',
      }}>
        <h2 style={{ fontSize: FS.lg, fontWeight: 700, color: C.text, marginBottom: 6 }}>Confirmar pago</h2>
        <p style={{ fontSize: FS.sm, color: C.textMid, marginBottom: 24 }}>Seleccioná el método de cobro</p>

        {/* Total */}
        <div style={{ background: C.accentBg, borderRadius: 0, padding: '16px 20px', marginBottom: 24, textAlign: 'center' }}>
          {descuento > 0 && (
            <div style={{ fontSize: FS.sm, color: C.textMid, marginBottom: 2 }}>
              Descuento aplicado: <span style={{ color: C.accent, fontWeight: 600, fontFamily: FONT.mono }}>- {fmt(descuento)}</span>
            </div>
          )}
          <div style={{ fontSize: FS.display, fontWeight: 700, color: C.accent, fontFamily: FONT.mono }}>{fmt(total)}</div>
        </div>

        {/* Métodos de pago */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 20 }}>
          {METODOS_PAGO.map(m => (
            <button key={m.id} onClick={() => setMetodo(m.id)} style={{
              padding: '8px 4px', borderRadius: 0, border: `1px solid ${metodo === m.id ? C.accent : C.border}`,
              background: metodo === m.id ? C.accentBg : C.white,
              color: metodo === m.id ? C.accent : C.textMid,
              fontSize: FS.sm, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
              fontFamily: FONT.sans,
            }}>
              {m.label}
            </button>
          ))}
        </div>

        {/* Monto recibido (solo efectivo) */}
        {metodo === 'EFECTIVO' && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: FS.sm, fontWeight: 600, color: C.textMid, marginBottom: 6 }}>
              Monto recibido
            </label>
            <input
              type="number"
              value={recibido}
              onChange={e => setRecibido(e.target.value)}
              placeholder="0"
              autoFocus
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 0,
                border: `1px solid ${C.border}`, fontSize: FS.md,
                fontFamily: FONT.mono, fontWeight: 500,
                outline: 'none', color: C.text,
                transition: 'border 0.15s',
              }}
              onFocus={e => e.currentTarget.style.border = `1px solid ${C.accent}`}
              onBlur={e => e.currentTarget.style.border = `1px solid ${C.border}`}
            />
            {vuelto !== null && vuelto >= 0 && (
              <div style={{ marginTop: 8, padding: '8px 12px', background: C.amberBg, borderRadius: 0, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: FS.sm, color: C.textMid }}>Vuelto</span>
                <span style={{ fontSize: FS.md, fontWeight: 700, color: C.amber, fontFamily: FONT.mono }}>{fmt(vuelto)}</span>
              </div>
            )}
          </div>
        )}

        {/* Botones */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '12px', borderRadius: 0, border: `1px dashed ${C.border}`,
            background: 'transparent', color: C.textMid, fontSize: FS.base, fontWeight: 600,
            cursor: 'pointer', fontFamily: FONT.sans, transition: 'all 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.background = C.bg}
            onMouseLeave={e => e.currentTarget.style.background = C.white}
          >
            Cancelar
          </button>
          <button
            onClick={() => puedeConfirmar && onConfirm({ metodo, montoRecibido: parseFloat(recibido) || total, vuelto: vuelto || 0 })}
            disabled={!puedeConfirmar}
            style={{
              flex: 2, padding: '12px', borderRadius: 0, border: 'none',
              background: puedeConfirmar ? C.accent : '#D1D5DB',
              color: '#fff', fontSize: FS.base, fontWeight: 700,
              cursor: puedeConfirmar ? 'pointer' : 'not-allowed',
              fontFamily: FONT.sans, transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
            onMouseEnter={e => { if (puedeConfirmar) e.currentTarget.style.background = C.accentHov; }}
            onMouseLeave={e => { if (puedeConfirmar) e.currentTarget.style.background = C.accent; }}
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Cobrar {fmt(total)}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// TICKET VENTA
// ============================================================

interface TicketVentaProps {
  venta: VentaFront;
  onNuevaVenta: () => void;
}

export const TicketVenta: FC<TicketVentaProps> = ({ venta, onNuevaVenta }) => {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: C.white, borderRadius: 0, width: 360, padding: '28px 32px',
        boxShadow: 'none', animation: 'slideIn 0.25s ease',
        textAlign: 'center',
      }}>
        {/* Check animado */}
        <div style={{
          width: 64, height: 64, borderRadius: '50%', background: C.accentBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
          animation: 'scanPulse 0.6s ease',
        }}>
          <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <h2 style={{ fontSize: FS.lg, fontWeight: 700, color: C.text, marginBottom: 4 }}>¡Venta registrada!</h2>
        <p style={{ fontSize: FS.xs, color: C.textLight, marginBottom: 24 }}>#{String(venta.id).padStart(6, '0')} · {now()}</p>

        {/* Detalle */}
        <div style={{ textAlign: 'left', background: C.bg, borderRadius: 0, padding: 16, marginBottom: 20 }}>
          {venta.items.map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: FS.base, color: C.textMid, fontFamily: FONT.sans }}>{item.cantidad}× {item.nombre}</span>
              <span style={{ fontSize: FS.sm, fontWeight: 600, color: C.text, fontFamily: FONT.mono }}>{fmt(item.subtotal)}</span>
            </div>
          ))}
          <div style={{ borderTop: `1px dashed ${C.border}`, marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: FS.base, fontWeight: 700, color: C.text }}>Total</span>
            <span style={{ fontSize: FS.md, fontWeight: 700, color: C.accent, fontFamily: FONT.mono }}>{fmt(venta.total)}</span>
          </div>
          {venta.vuelto > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ fontSize: FS.sm, color: C.textMid }}>Vuelto</span>
              <span style={{ fontSize: FS.sm, fontWeight: 600, color: C.amber, fontFamily: FONT.mono }}>{fmt(venta.vuelto)}</span>
            </div>
          )}
        </div>

        <button onClick={onNuevaVenta} style={{
          width: '100%', padding: '13px', borderRadius: 0, border: 'none',
          background: C.accent, color: '#fff', fontSize: FS.base, fontWeight: 700,
          cursor: 'pointer', fontFamily: FONT.sans, transition: 'all 0.15s',
        }}
          onMouseEnter={e => e.currentTarget.style.background = C.accentHov}
          onMouseLeave={e => e.currentTarget.style.background = C.accent}
        >
          Nueva venta
        </button>
      </div>
    </div>
  );
};
