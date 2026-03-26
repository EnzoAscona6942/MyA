import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { API_URL, getHeaders } from "../lib/api";
import CierreCaja from "./CierreCaja";
import Stock from "./Stock";
import Productos from "./Productos";
import Reportes from "./Reportes";
import Ventas from "./Ventas";
import AuditLog from "./AuditLog";
import Usuarios from "./Usuarios";

// ── Fuentes via Google Fonts ─────────────────────────────────
const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap";
document.head.appendChild(fontLink);

// ── Estilos globales ─────────────────────────────────────────
const globalStyles = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Mono', monospace; background: #F5F5F0; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #D1D5DB; border-radius: 99px; }

  @keyframes slideIn {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes scanPulse {
    0%   { box-shadow: 0 0 0 0 rgba(22,163,74,0.4); }
    70%  { box-shadow: 0 0 0 10px rgba(22,163,74,0); }
    100% { box-shadow: 0 0 0 0 rgba(22,163,74,0); }
  }
  @keyframes flashGreen {
    0%   { background: #DCFCE7; }
    100% { background: #FFFFFF; }
  }
  .item-enter { animation: slideIn 0.2s ease forwards; }
  .flash-green { animation: flashGreen 0.6s ease forwards; }
`;
const styleTag = document.createElement("style");
styleTag.textContent = globalStyles;
document.head.appendChild(styleTag);


// ── Paleta de colores ────────────────────────────────────────
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

// ── Nav items ────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: "pos", label: "Caja / POS", icon: ShopIcon },
  { id: "stock", label: "Stock", icon: BoxIcon },
  { id: "caja", label: "Cierre de Caja", icon: CajaIcon },
  { id: "reportes", label: "Reportes", icon: ChartIcon },
  { id: "productos", label: "Productos", icon: TagIcon },
  { id: "ventas", label: "Ventas", icon: TagIcon },
  { id: "usuarios", label: "Usuarios", icon: TagIcon },
  { id: "audit", label: "Auditoría", icon: TagIcon },
];

// ── Iconos SVG inline ────────────────────────────────────────
function ShopIcon({ size = 18, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 01-8 0" />
    </svg>
  );
}
function BoxIcon({ size = 18, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}
function CajaIcon({ size = 18, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
    </svg>
  );
}
function ChartIcon({ size = 18, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /><line x1="2" y1="20" x2="22" y2="20" />
    </svg>
  );
}
function TagIcon({ size = 18, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}
function BarcodeIcon({ size = 20, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5v14M7 5v14M11 5v14M15 5v14M19 5v14M3 5h2M3 19h2M19 5h2M19 19h2" />
    </svg>
  );
}
function TrashIcon({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
    </svg>
  );
}
function CheckIcon({ size = 22, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function LogoutIcon({ size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
function SearchIcon({ size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

// ── Helpers ──────────────────────────────────────────────────
const fmt = (n) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
const now = () => new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
const today = () => new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });

// ════════════════════════════════════════════════════════════
//  SIDEBAR
// ════════════════════════════════════════════════════════════
function Sidebar({ activeModule, setActiveModule }) {
  const { usuario, logout } = useAuth();
  return (
    <aside style={{
      width: 220, minHeight: "100vh", background: C.sidebar,
      display: "flex", flexDirection: "column",
      position: "fixed", left: 0, top: 0, bottom: 0, zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ padding: "28px 24px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 0,
            background: C.accent, display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 16, fontFamily: "'DM Mono', monospace" }}>M</span>
          </div>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 15, letterSpacing: "-0.3px" }}>MyA</div>
            <div style={{ color: "#6B7280", fontSize: 10, fontWeight: 400, letterSpacing: "0.5px", textTransform: "uppercase" }}>Minimercado</div>
          </div>
        </div>
      </div>

      {/* Fecha */}
      <div style={{ padding: "0 16px 20px" }}>
        <div style={{
          background: "rgba(255,255,255,0.05)", borderRadius: 0, padding: "8px 12px",
        }}>
          <div style={{ color: "#9CA3AF", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>{today()}</div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "0 12px" }}>
        <div style={{ color: "#4B5563", fontSize: 10, fontWeight: 600, letterSpacing: "0.8px", textTransform: "uppercase", padding: "0 8px 8px" }}>Módulos</div>
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const active = activeModule === id;
          return (
            <button key={id} onClick={() => setActiveModule(id)} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10,
              padding: "9px 12px", borderRadius: 0, border: "none", cursor: "pointer",
              marginBottom: 2, transition: "all 0.15s",
              background: active ? "rgba(22,163,74,0.15)" : "transparent",
              color: active ? C.accent : "#9CA3AF",
            }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "#fff"; } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#9CA3AF"; } }}
            >
              <Icon size={16} color="currentColor" />
              <span style={{ fontSize: 13, fontWeight: active ? 600 : 400 }}>{label}</span>
              {active && <div style={{ marginLeft: "auto", width: 5, height: 5, borderRadius: "50%", background: C.accent }} />}
            </button>
          );
        })}
      </nav>

      {/* Usuario */}
      <div style={{ padding: "16px 12px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px" }}>
          <div style={{
            width: 30, height: 30, borderRadius: "50%",
            background: "linear-gradient(135deg, #16A34A, #059669)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ color: "#fff", fontSize: 12, fontWeight: 600 }}>{usuario?.nombre?.substring(0, 2).toUpperCase() || "US"}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "#F9FAFB", fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{usuario?.nombre || "Usuario"}</div>
            <div style={{ color: "#6B7280", fontSize: 10 }}>{usuario?.rol || "Rol"}</div>
          </div>
          <button onClick={logout} style={{ background: "none", border: "none", cursor: "pointer", color: "#6B7280", padding: 4 }}
            onMouseEnter={e => e.currentTarget.style.color = "#EF4444"}
            onMouseLeave={e => e.currentTarget.style.color = "#6B7280"}
          >
            <LogoutIcon size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}

// ════════════════════════════════════════════════════════════
//  MODAL DE PAGO
// ════════════════════════════════════════════════════════════
function ModalPago({ total, descuento, onConfirm, onClose }) {
  const [metodo, setMetodo] = useState("EFECTIVO");
  const [recibido, setRecibido] = useState("");
  const vuelto = metodo === "EFECTIVO" && recibido ? parseFloat(recibido) - total : null;
  const puedeConfirmar = metodo !== "EFECTIVO" || (recibido && parseFloat(recibido) >= total);

  const METODOS = [
    { id: "EFECTIVO", label: "Efectivo" },
    { id: "TARJETA_DEBITO", label: "Débito" },
    { id: "TARJETA_CREDITO", label: "Crédito" },
    { id: "TRANSFERENCIA", label: "Transferencia" },
    { id: "QR", label: "QR" },
  ];

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
      animation: "fadeIn 0.15s ease",
    }}>
      <div style={{
        background: C.white, borderRadius: 0, width: 420, padding: 32,
        boxShadow: "none",
        animation: "slideIn 0.2s ease",
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 6 }}>Confirmar pago</h2>
        <p style={{ fontSize: 13, color: C.textMid, marginBottom: 24 }}>Seleccioná el método de cobro</p>

        {/* Total */}
        <div style={{ background: C.accentBg, borderRadius: 0, padding: "16px 20px", marginBottom: 24, textAlign: "center" }}>
          {descuento > 0 && (
            <div style={{ fontSize: 12, color: C.textMid, marginBottom: 2 }}>
              Descuento aplicado: <span style={{ color: C.accent, fontWeight: 600 }}>- {fmt(descuento)}</span>
            </div>
          )}
          <div style={{ fontSize: 32, fontWeight: 700, color: C.accent, fontFamily: "'DM Mono', monospace" }}>{fmt(total)}</div>
        </div>

        {/* Métodos de pago */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, marginBottom: 20 }}>
          {METODOS.map(m => (
            <button key={m.id} onClick={() => setMetodo(m.id)} style={{
              padding: "8px 4px", borderRadius: 0, border: `1px solid ${metodo === m.id ? C.accent : C.border}`,
              background: metodo === m.id ? C.accentBg : C.white,
              color: metodo === m.id ? C.accent : C.textMid,
              fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
              fontFamily: "'DM Mono', monospace",
            }}>
              {m.label}
            </button>
          ))}
        </div>

        {/* Monto recibido (solo efectivo) */}
        {metodo === "EFECTIVO" && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.textMid, marginBottom: 6 }}>
              Monto recibido
            </label>
            <input
              type="number"
              value={recibido}
              onChange={e => setRecibido(e.target.value)}
              placeholder="0"
              autoFocus
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 0,
                border: `1px solid ${C.border}`, fontSize: 18,
                fontFamily: "'DM Mono', monospace", fontWeight: 500,
                outline: "none", color: C.text,
                transition: "border 0.15s",
              }}
              onFocus={e => e.target.style.border = `1px solid ${C.accent}`}
              onBlur={e => e.target.style.border = `1px solid ${C.border}`}
            />
            {vuelto !== null && vuelto >= 0 && (
              <div style={{ marginTop: 8, padding: "8px 12px", background: C.amberBg, borderRadius: 0, display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: C.textMid }}>Vuelto</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: C.amber, fontFamily: "'DM Mono', monospace" }}>{fmt(vuelto)}</span>
              </div>
            )}
          </div>
        )}

        {/* Botones */}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "12px", borderRadius: 0, border: `1px dashed ${C.border}`,
            background: "transparent", color: C.textMid, fontSize: 14, fontWeight: 600,
            cursor: "pointer", fontFamily: "'DM Mono', monospace", transition: "all 0.15s",
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
              flex: 2, padding: "12px", borderRadius: 0, border: "none",
              background: puedeConfirmar ? C.accent : "#D1D5DB",
              color: "#fff", fontSize: 14, fontWeight: 700,
              cursor: puedeConfirmar ? "pointer" : "not-allowed",
              fontFamily: "'DM Mono', monospace", transition: "all 0.15s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
            onMouseEnter={e => { if (puedeConfirmar) e.currentTarget.style.background = C.accentHov; }}
            onMouseLeave={e => { if (puedeConfirmar) e.currentTarget.style.background = C.accent; }}
          >
            <CheckIcon size={18} />
            Cobrar {fmt(total)}
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  TICKET DE VENTA (post-cobro)
// ════════════════════════════════════════════════════════════
function TicketVenta({ venta, onNuevaVenta }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
    }}>
      <div style={{
        background: C.white, borderRadius: 0, width: 360, padding: "28px 32px",
        boxShadow: "none", animation: "slideIn 0.25s ease",
        textAlign: "center",
      }}>
        {/* Check animado */}
        <div style={{
          width: 64, height: 64, borderRadius: "50%", background: C.accentBg,
          display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
          animation: "scanPulse 0.6s ease",
        }}>
          <CheckIcon size={28} color={C.accent} />
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 4 }}>¡Venta registrada!</h2>
        <p style={{ fontSize: 12, color: C.textLight, marginBottom: 24 }}>#{String(venta.id).padStart(6, "0")} · {now()}</p>

        {/* Detalle */}
        <div style={{ textAlign: "left", background: C.bg, borderRadius: 0, padding: 16, marginBottom: 20 }}>
          {venta.items.map((item, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: C.textMid }}>{item.cantidad}× {item.nombre}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.text, fontFamily: "'DM Mono', monospace" }}>{fmt(item.subtotal)}</span>
            </div>
          ))}
          <div style={{ borderTop: `1px dashed ${C.border}`, marginTop: 10, paddingTop: 10, display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Total</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: C.accent, fontFamily: "'DM Mono', monospace" }}>{fmt(venta.total)}</span>
          </div>
          {venta.vuelto > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
              <span style={{ fontSize: 12, color: C.textMid }}>Vuelto</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.amber, fontFamily: "'DM Mono', monospace" }}>{fmt(venta.vuelto)}</span>
            </div>
          )}
        </div>

        <button onClick={onNuevaVenta} style={{
          width: "100%", padding: "13px", borderRadius: 0, border: "none",
          background: C.accent, color: "#fff", fontSize: 14, fontWeight: 700,
          cursor: "pointer", fontFamily: "'DM Mono', monospace", transition: "all 0.15s",
        }}
          onMouseEnter={e => e.currentTarget.style.background = C.accentHov}
          onMouseLeave={e => e.currentTarget.style.background = C.accent}
        >
          Nueva venta
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  POS — PANTALLA PRINCIPAL
// ════════════════════════════════════════════════════════════
function POS() {
  const [carrito, setCarrito] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [productosFiltrados, setProductosFiltrados] = useState([]);
  const [frecuentes, setFrecuentes] = useState([]);
  const [descuento, setDescuento] = useState(0);
  const [modal, setModal] = useState(null); // null | "pago" | "ticket"
  const [ventaExitosa, setVentaExitosa] = useState(null);
  const [flashId, setFlashId] = useState(null);
  const [scanBuffer, setScanBuffer] = useState("");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const searchRef = useRef(null);

  // ── Subtotal y total ──────────────────────────────────────
  const subtotal = carrito.reduce((acc, i) => acc + i.precio * i.cantidad, 0);
  const total = Math.max(0, subtotal - descuento);

  // ── Buscar producto por código o nombre ───────────────────
  const buscarPorCodigo = useCallback(async (codigo) => {
    try {
      const res = await fetch(`${API_URL}/productos/barras/${codigo.trim()}`, { headers: getHeaders() });
      if (!res.ok) throw new Error("No encontrado");
      const prod = await res.json();
      agregarAlCarrito(prod);
      setBusqueda("");
      setError("");
    } catch (err) {
      setError(`Código "${codigo}" no encontrado`);
      setTimeout(() => setError(""), 2500);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Captura del lector de barras ──────────────────────────
  useEffect(() => {
    let buffer = "";
    let timeout;

    const onKeyDown = (e) => {
      // Ignorar si el foco está en un input numérico (monto recibido)
      if (e.target.tagName === "INPUT" && e.target.type === "number") return;

      if (e.key === "Enter") {
        if (buffer.length >= 4) {
          setScanning(true);
          buscarPorCodigo(buffer);
          setTimeout(() => setScanning(false), 400);
        }
        buffer = "";
      } else if (e.key.length === 1) {
        buffer += e.key;
        clearTimeout(timeout);
        timeout = setTimeout(() => { buffer = ""; }, 150);

        // Refleja en el campo de búsqueda si tiene foco
        if (document.activeElement === searchRef.current) return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => { window.removeEventListener("keydown", onKeyDown); clearTimeout(timeout); };
  }, [buscarPorCodigo]);

  // ── Agregar al carrito ────────────────────────────────────
  const agregarAlCarrito = (prod) => {
    setCarrito(prev => {
      const existe = prev.find(i => i.id === prod.id);
      if (existe) {
        setFlashId(prod.id);
        setTimeout(() => setFlashId(null), 600);
        return prev.map(i => i.id === prod.id ? { ...i, cantidad: i.cantidad + 1 } : i);
      }
      return [...prev, { ...prod, cantidad: 1 }];
    });
  };

  const cambiarCantidad = (id, delta) => {
    setCarrito(prev =>
      prev.map(i => i.id === id ? { ...i, cantidad: Math.max(1, i.cantidad + delta) } : i)
    );
  };

  const quitarItem = (id) => setCarrito(prev => prev.filter(i => i.id !== id));

  // ── Productos filtrados (búsqueda manual) ─────────────────
  useEffect(() => {
    if (busqueda.trim().length >= 2) {
      const delay = setTimeout(async () => {
        try {
          const res = await fetch(`${API_URL}/productos?busqueda=${encodeURIComponent(busqueda.trim())}`, { headers: getHeaders() });
          if (res.ok) setProductosFiltrados(await res.json());
        } catch (e) {
          console.error("Error al buscar productos", e);
        }
      }, 300);
      return () => clearTimeout(delay);
    } else {
      setProductosFiltrados([]);
    }
  }, [busqueda]);

  // ── Cargar productos frecuentes iniciales ─────────────────
  useEffect(() => {
    const fetchFrecuentes = async () => {
      try {
        const res = await fetch(`${API_URL}/productos`, { headers: getHeaders() });
        if (res.ok) {
          const data = await res.json();
          setFrecuentes(data.slice(0, 6));
        }
      } catch (e) {
        console.error("Error cargando frecuentes", e);
      }
    };
    fetchFrecuentes();
  }, []);

  // ── Confirmar cobro ───────────────────────────────────────
  const confirmarCobro = async ({ metodo, montoRecibido, vuelto }) => {
    const cajaId = localStorage.getItem("cajaId") || 1; // Ajustar según tu lógica de caja
    const payload = {
      cajaId: parseInt(cajaId),
      items: carrito.map(i => ({
        productoId: i.id,
        cantidad: i.cantidad,
      })),
      descuento,
      metodoPago: metodo,
      montoRecibido,
    };

    try {
      const res = await fetch(`${API_URL}/ventas`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al registrar la venta");
      }

      const ventaConfirmada = await res.json();

      const ventaFront = {
        id: ventaConfirmada.id,
        items: carrito.map(i => ({
          nombre: i.nombre,
          cantidad: i.cantidad,
          subtotal: i.precio * i.cantidad,
        })),
        total,
        metodo,
        vuelto,
      };

      setVentaExitosa(ventaFront);
      setModal("ticket");
    } catch (e) {
      setError(`Error al cobrar: ${e.message}`);
      setTimeout(() => setError(""), 3500);
      setModal(null);
    }
  };

  const nuevaVenta = () => {
    setCarrito([]);
    setDescuento(0);
    setBusqueda("");
    setModal(null);
    setVentaExitosa(null);
    searchRef.current?.focus();
  };

  // ════════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════════
  return (
    <div style={{ display: "flex", height: "100vh", gap: 0 }}>

      {/* ── Panel izquierdo: búsqueda + productos ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "24px 20px 24px 24px", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: C.text, letterSpacing: "-0.4px" }}>Punto de Venta</h1>
            <p style={{ fontSize: 12, color: C.textLight, marginTop: 2 }}>Escaneá o buscá un producto para agregar</p>
          </div>
          {/* Indicador de scanner */}
          <div style={{
            display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
            background: scanning ? C.accentBg : C.white,
            border: `1px solid ${scanning ? C.accent : C.border}`,
            borderRadius: 0, transition: "all 0.2s",
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: "50%",
              background: scanning ? C.accent : "#D1D5DB",
              transition: "all 0.2s",
              ...(scanning ? { animation: "scanPulse 0.4s ease" } : {}),
            }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: scanning ? C.accent : C.textLight }}>
              {scanning ? "Leyendo..." : "Scanner listo"}
            </span>
          </div>
        </div>

        {/* Barra de búsqueda */}
        <div style={{ position: "relative", marginBottom: 16 }}>
          <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
            <SearchIcon size={16} color={C.textLight} />
          </div>
          <input
            ref={searchRef}
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && busqueda.trim()) {
                // Si hay un solo resultado, agregarlo. Si no buscar en API
                if (productosFiltrados.length === 1) {
                  agregarAlCarrito(productosFiltrados[0]);
                  setBusqueda("");
                } else {
                  buscarPorCodigo(busqueda);
                }
              }
            }}
            placeholder="Buscar por nombre o escanear código de barras..."
            autoFocus
            style={{
              width: "100%", padding: "12px 16px 12px 42px",
              border: `1px solid ${C.border}`, borderRadius: 0,
              fontSize: 14, fontFamily: "'DM Mono', monospace",
              outline: "none", background: C.white, color: C.text,
              transition: "border 0.15s",
            }}
            onFocus={e => e.target.style.border = `1px solid ${C.accent}`}
            onBlur={e => e.target.style.border = `1px solid ${C.border}`}
          />
          {busqueda && (
            <button onClick={() => setBusqueda("")} style={{
              position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer", color: C.textLight,
              fontSize: 18, lineHeight: 1,
            }}>×</button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: "10px 14px", background: C.dangerBg, borderRadius: 0,
            color: C.danger, fontSize: 13, fontWeight: 500, marginBottom: 12,
            border: `1px solid #FECACA`, animation: "slideIn 0.2s ease",
          }}>
            ⚠ {error}
          </div>
        )}

        {/* Resultados de búsqueda */}
        {productosFiltrados.length > 0 && (
          <div style={{
            background: C.white, border: `1px solid ${C.border}`, borderRadius: 0,
            overflow: "hidden", marginBottom: 16, boxShadow: "none",
          }}>
            {productosFiltrados.map((p, i) => (
              <button key={p.id} onClick={() => { agregarAlCarrito(p); setBusqueda(""); }} style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "11px 16px", border: "none", background: C.white, cursor: "pointer",
                borderTop: i > 0 ? `1px solid ${C.border}` : "none",
                transition: "background 0.1s", textAlign: "left",
                fontFamily: "'DM Mono', monospace",
              }}
                onMouseEnter={e => e.currentTarget.style.background = C.bg}
                onMouseLeave={e => e.currentTarget.style.background = C.white}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{p.nombre}</div>
                  <div style={{ fontSize: 11, color: C.textLight, marginTop: 1 }}>{p.codigoBarras} · {p.categoria}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.accent, fontFamily: "'DM Mono', monospace" }}>{fmt(p.precio)}</div>
                  <div style={{ fontSize: 11, color: p.stock <= 5 ? C.danger : C.textLight }}>Stock: {p.stock}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Accesos rápidos cuando no hay búsqueda */}
        {!busqueda && (
          <>
            <p style={{ fontSize: 11, fontWeight: 600, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>
              Productos frecuentes
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, overflowY: "auto" }}>
              {frecuentes.map(p => (
                <button key={p.id} onClick={() => agregarAlCarrito(p)} style={{
                  padding: "12px 14px", borderRadius: 0, border: `1px solid ${C.border}`,
                  background: C.white, cursor: "pointer", textAlign: "left",
                  transition: "all 0.15s", fontFamily: "'DM Mono', monospace",
                }}
                  onMouseEnter={e => { e.currentTarget.style.border = `1px solid ${C.accent}`; e.currentTarget.style.background = C.accentBg; }}
                  onMouseLeave={e => { e.currentTarget.style.border = `1px solid ${C.border}`; e.currentTarget.style.background = C.white; }}
                >
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 4, lineHeight: 1.3 }}>{p.nombre}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
        width: 340, background: C.white, display: "flex", flexDirection: "column",
        borderLeft: `1px dashed ${C.border}`, height: "100vh",
        boxShadow: "none",
      }}>

        {/* Header carrito */}
        <div style={{ padding: "24px 20px 16px", borderBottom: `1px dashed ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
              Carrito
              {carrito.length > 0 && (
                <span style={{
                  marginLeft: 8, background: C.accent, color: "#fff",
                  borderRadius: 0, padding: "1px 8px", fontSize: 11, fontWeight: 600,
                }}>
                  {carrito.reduce((a, i) => a + i.cantidad, 0)}
                </span>
              )}
            </h2>
            {carrito.length > 0 && (
              <button onClick={() => setCarrito([])} style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: 11, color: C.danger, fontWeight: 600,
                fontFamily: "'DM Mono', monospace",
              }}>
                Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Items del carrito */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
          {carrito.length === 0 ? (
            <div style={{ padding: "48px 20px", textAlign: "center" }}>
              <div style={{ marginBottom: 12, opacity: 0.3 }}>
                <BarcodeIcon size={40} color={C.textLight} />
              </div>
              <p style={{ fontSize: 13, color: C.textLight, lineHeight: 1.5 }}>
                Escaneá un producto<br />o buscalo arriba
              </p>
            </div>
          ) : (
            carrito.map(item => (
              <div key={item.id} className="item-enter" style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 8px", borderRadius: 0, marginBottom: 4,
                background: flashId === item.id ? C.accentBg : "transparent",
                transition: "background 0.3s",
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
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button onClick={() => cambiarCantidad(item.id, -1)} style={{
                    width: 24, height: 24, borderRadius: 0, border: `1px solid ${C.border}`,
                    background: C.white, cursor: "pointer", fontSize: 14, color: C.textMid,
                    display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
                  }}>−</button>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.text, minWidth: 20, textAlign: "center", fontFamily: "'DM Mono', monospace" }}>
                    {item.cantidad}
                  </span>
                  <button onClick={() => cambiarCantidad(item.id, 1)} style={{
                    width: 24, height: 24, borderRadius: 0, border: `1px solid ${C.border}`,
                    background: C.white, cursor: "pointer", fontSize: 14, color: C.textMid,
                    display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
                  }}>+</button>
                </div>

                {/* Subtotal */}
                <div style={{ textAlign: "right", minWidth: 64 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text, fontFamily: "'DM Mono', monospace" }}>
                    {fmt(item.precio * item.cantidad)}
                  </div>
                  <button onClick={() => quitarItem(item.id)} style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: C.textLight, padding: "2px 0", marginTop: 2,
                    display: "flex", alignItems: "center", justifyContent: "flex-end", width: "100%",
                  }}
                    onMouseEnter={e => e.currentTarget.style.color = C.danger}
                    onMouseLeave={e => e.currentTarget.style.color = C.textLight}
                  >
                    <TrashIcon size={12} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer: descuento + totales + cobrar */}
        <div style={{ borderTop: `1px dashed ${C.border}`, padding: "16px 20px" }}>

          {/* Descuento */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: C.textMid, fontWeight: 500, whiteSpace: "nowrap" }}>Descuento $</label>
            <input
              type="number"
              value={descuento || ""}
              onChange={e => setDescuento(parseFloat(e.target.value) || 0)}
              placeholder="0"
              min="0"
              style={{
                flex: 1, padding: "7px 10px", border: `1px solid ${C.border}`,
                borderRadius: 0, fontSize: 13, fontFamily: "'DM Mono', monospace",
                outline: "none", color: C.text,
              }}
              onFocus={e => e.target.style.border = `1px solid ${C.amber}`}
              onBlur={e => e.target.style.border = `1px solid ${C.border}`}
            />
          </div>

          {/* Subtotal */}
          {descuento > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: C.textMid }}>Subtotal</span>
              <span style={{ fontSize: 12, color: C.textMid, fontFamily: "'DM Mono', monospace" }}>{fmt(subtotal)}</span>
            </div>
          )}
          {descuento > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: C.amber }}>Descuento</span>
              <span style={{ fontSize: 12, color: C.amber, fontFamily: "'DM Mono', monospace" }}>− {fmt(descuento)}</span>
            </div>
          )}

          {/* Total */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "12px 14px", background: carrito.length > 0 ? C.accentBg : C.bg,
            borderRadius: 0, marginBottom: 12, transition: "background 0.3s",
          }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>TOTAL</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: carrito.length > 0 ? C.accent : C.textLight, fontFamily: "'DM Mono', monospace" }}>
              {fmt(total)}
            </span>
          </div>

          {/* Botón cobrar */}
          <button
            onClick={() => carrito.length > 0 && setModal("pago")}
            disabled={carrito.length === 0}
            style={{
              width: "100%", padding: "14px", borderRadius: 0, border: "none",
              background: carrito.length > 0 ? C.accent : "transparent",
              color: carrito.length > 0 ? C.text : C.textLight,
              borderTop: `1px dashed ${C.border}`,
              borderBottom: `1px dashed ${C.border}`,
              fontSize: 15, fontWeight: 700, cursor: carrito.length > 0 ? "pointer" : "not-allowed",
              fontFamily: "'DM Mono', monospace", transition: "all 0.2s",
              letterSpacing: "-0.2px",
            }}
            onMouseEnter={e => { if (carrito.length > 0) e.currentTarget.style.background = C.accentHov; }}
            onMouseLeave={e => { if (carrito.length > 0) e.currentTarget.style.background = C.accent; }}
          >
            Cobrar {carrito.length > 0 ? fmt(total) : ""}
          </button>
        </div>
      </div>

      {/* Modales */}
      {modal === "pago" && (
        <ModalPago
          total={total}
          descuento={descuento}
          onConfirm={confirmarCobro}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "ticket" && ventaExitosa && (
        <TicketVenta venta={ventaExitosa} onNuevaVenta={nuevaVenta} />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  PLACEHOLDER para módulos pendientes
// ════════════════════════════════════════════════════════════
function ModuloPendiente({ nombre }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 40, opacity: 0.2 }}>🔧</div>
      <p style={{ fontSize: 14, color: C.textLight, fontWeight: 500 }}>{nombre} — Próximamente</p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  APP ROOT
// ════════════════════════════════════════════════════════════
export default function MainApp() {
  const [activeModule, setActiveModule] = useState("pos");

  const renderModule = () => {
    switch (activeModule) {
      case "pos": return <POS />;
      case "stock": return <Stock />;
      case "caja": return <CierreCaja />;
      case "productos": return <Productos />;
      case "reportes": return <Reportes />;
      case "ventas": return <Ventas />;
      case "usuarios": return <Usuarios />;
      case "audit": return <AuditLog />;
      default: return <POS />;
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: C.bg }}>
      <Sidebar activeModule={activeModule} setActiveModule={setActiveModule} />
      <main style={{ marginLeft: 220, flex: 1, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        {renderModule()}
      </main>
    </div>
  );
}
