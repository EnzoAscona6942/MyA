import { useState, useEffect, type ChangeEvent, type FormEvent } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { Usuario } from '../types/api';
import { C } from '../theme';

/**
 * `PUT /usuarios/:id` y `PUT /usuarios/:id/activar` responden con un `select`
 * parcial de Prisma: sin `password` y sin `creadoEn`.
 */
type UsuarioActualizado = Pick<Usuario, 'id' | 'nombre' | 'email' | 'rol' | 'activo'>;

/** `POST /auth/register` responde `{ mensaje, usuario }` con un select más chico. */
interface RegisterResponse {
  mensaje: string;
  usuario: Pick<Usuario, 'id' | 'nombre' | 'email' | 'rol'>;
}

interface UsuarioForm {
  nombre: string;
  email: string;
  password: string;
  rol: Usuario['rol'];
}

const ROLES: Array<{ value: Usuario['rol']; label: string }> = [
  { value: 'ADMIN', label: 'Administrador' },
  { value: 'CAJERO', label: 'Cajero' }
];

export default function Usuarios() {
  const { usuario: currentUser } = useAuth();

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modal ABM
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form State
  const initialForm: UsuarioForm = {
    nombre: '',
    email: '',
    password: '',
    rol: 'CAJERO'
  };
  const [formData, setFormData] = useState<UsuarioForm>(initialForm);
  const [formError, setFormError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // ── INIT ──
  useEffect(() => {
    fetchUsuarios();
  }, []);

  const fetchUsuarios = async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await api.get<Usuario[]>('/usuarios');
      setUsuarios(data || []);
    } catch (e: unknown) {
      console.error("Error al cargar usuarios", e);
      setFormError("Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  };

  // ── ACTIONS ──
  const handleOpenNuevo = (): void => {
    setEditingId(null);
    setFormData(initialForm);
    setFormError('');
    setSuccess('');
    setShowModal(true);
  };

  const handleOpenEdit = (u: Usuario): void => {
    setEditingId(u.id);
    setFormData({
      nombre: u.nombre,
      email: u.email,
      password: '', // No mostrar password
      rol: u.rol
    });
    setFormError('');
    setSuccess('');
    setShowModal(true);
  };

  const handleToggleActivo = async (u: Usuario): Promise<void> => {
    try {
      if (u.activo) {
        // Desactivar
        if (!window.confirm(`¿Desactivar al usuario "${u.nombre}"?`)) return;
        await api.delete<{ message: string }>(`/usuarios/${u.id}`);
        setSuccess(`Usuario "${u.nombre}" desactivado.`);
      } else {
        // Activar — la ruta no lee el body, por eso se manda `undefined`.
        await api.put<UsuarioActualizado>(`/usuarios/${u.id}/activar`, undefined);
        setSuccess(`Usuario "${u.nombre}" activado.`);
      }
      setTimeout(() => setSuccess(''), 3000);
      fetchUsuarios();
    } catch (e: unknown) {
      // El cliente de API lanza `ApiError` (objeto plano), no una `Error`.
      const err = e as { error?: string; message?: string };
      alert("Error: " + (err.error || err.message));
    }
  };

  const validateForm = (): boolean => {
    if (!formData.nombre.trim()) {
      setFormError("El nombre es requerido");
      return false;
    }
    if (!formData.email.trim()) {
      setFormError("El email es requerido");
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setFormError("El email no es válido");
      return false;
    }
    // Password requerido solo para nuevos usuarios
    if (!editingId && (!formData.password || formData.password.length < 6)) {
      setFormError("La contraseña debe tener al menos 6 caracteres");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setFormError('');

    if (!validateForm()) return;

    setSubmitting(true);

    try {
      const payload: {
        nombre: string;
        email: string;
        rol: Usuario['rol'];
        password?: string;
      } = {
        nombre: formData.nombre.trim(),
        email: formData.email.trim(),
        rol: formData.rol
      };

      // Solo incluir password si se proporcionó
      if (formData.password && formData.password.length >= 6) {
        payload.password = formData.password;
      }

      if (editingId) {
        await api.put<UsuarioActualizado>(`/usuarios/${editingId}`, payload);
        setSuccess('Usuario modificado exitosamente.');
      } else {
        // Crear nuevo usuario usando el endpoint de registro
        await api.post<RegisterResponse>('/auth/register', payload);
        setSuccess('Usuario creado exitosamente.');
      }
      setShowModal(false);
      setTimeout(() => setSuccess(''), 3000);
      fetchUsuarios();
    } catch (e: unknown) {
      // El cliente de API lanza `ApiError` (objeto plano), no una `Error`.
      const err = e as { error?: string };
      setFormError(err.error || "Error al guardar el usuario");
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Role guard
  if (currentUser?.rol !== 'ADMIN') {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: C.bg,
        fontFamily: "'DM Mono', monospace"
      }}>
        <div style={{
          background: C.white,
          padding: "48px 64px",
          borderRadius: 0,
          border: `1px solid ${C.border}`,
          textAlign: "center"
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 8 }}>
            Acceso restringido
          </h2>
          <p style={{ fontSize: 13, color: C.textMid }}>
            Solo los administradores pueden gestionar usuarios.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: C.bg, fontFamily: "'DM Mono', monospace" }}>

      {/* ── HEADER ── */}
      <div style={{ padding: "32px 32px 24px 32px", borderBottom: `1px solid ${C.border}`, background: C.white, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text, marginBottom: 4 }}>Gestión de Usuarios</h1>
          <p style={{ fontSize: 13, color: C.textLight }}>Administrar usuarios del sistema.</p>
        </div>
        <button onClick={handleOpenNuevo} style={{
          padding: "12px 20px", borderRadius: 0, background: C.text, color: "#fff",
          border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer", transition: "opacity 0.2s"
        }} onMouseEnter={e => e.currentTarget.style.opacity = "0.8"} onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
          + Nuevo Usuario
        </button>
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

        {/* Tabla */}
        <div style={{ background: C.white, borderRadius: 0, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#F9FAFB", borderBottom: `1px solid ${C.border}` }}>
                <th style={{ padding: "14px 20px", fontSize: 11, fontWeight: 600, color: C.textLight, textTransform: "uppercase" }}>ID</th>
                <th style={{ padding: "14px 20px", fontSize: 11, fontWeight: 600, color: C.textLight, textTransform: "uppercase" }}>Nombre</th>
                <th style={{ padding: "14px 20px", fontSize: 11, fontWeight: 600, color: C.textLight, textTransform: "uppercase" }}>Email</th>
                <th style={{ padding: "14px 20px", fontSize: 11, fontWeight: 600, color: C.textLight, textTransform: "uppercase" }}>Rol</th>
                <th style={{ padding: "14px 20px", fontSize: 11, fontWeight: 600, color: C.textLight, textTransform: "uppercase" }}>Estado</th>
                <th style={{ padding: "14px 20px", fontSize: 11, fontWeight: 600, color: C.textLight, textTransform: "uppercase", textAlign: "right" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: C.textLight, fontSize: 13 }}>Cargando datos...</td></tr>
              ) : usuarios.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: C.textLight, fontSize: 13 }}>No se encontraron usuarios.</td></tr>
              ) : (
                usuarios.map((u, i) => (
                  <tr key={u.id} style={{ borderBottom: i < usuarios.length - 1 ? `1px solid ${C.border}` : "none", transition: "background 0.1s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#F9FAFB"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={{ padding: "14px 20px", fontSize: 12, color: C.textLight, fontFamily: "'DM Mono', monospace" }}>{u.id}</td>
                    <td style={{ padding: "14px 20px", fontSize: 13, fontWeight: 600, color: C.text }}>{u.nombre}</td>
                    <td style={{ padding: "14px 20px", fontSize: 12, color: C.textMid }}>{u.email}</td>
                    <td style={{ padding: "14px 20px", fontSize: 12 }}>
                      <span style={{
                        padding: "4px 8px",
                        borderRadius: 0,
                        fontSize: 11,
                        fontWeight: 600,
                        background: u.rol === 'ADMIN' ? C.amberBg : C.blueBg,
                        color: u.rol === 'ADMIN' ? C.amber : C.blue
                      }}>
                        {u.rol === 'ADMIN' ? 'ADMIN' : 'CAJERO'}
                      </span>
                    </td>
                    <td style={{ padding: "14px 20px", fontSize: 12 }}>
                      <span style={{
                        padding: "4px 8px",
                        borderRadius: 0,
                        fontSize: 11,
                        fontWeight: 600,
                        background: u.activo ? C.accentBg : C.dangerBg,
                        color: u.activo ? C.accent : C.danger
                      }}>
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td style={{ padding: "14px 20px", textAlign: "right" }}>
                      <button onClick={() => handleOpenEdit(u)} style={{ background: "none", border: "none", color: C.blue, cursor: "pointer", fontSize: 13, fontWeight: 600, marginRight: 16 }}>Editar</button>
                      <button onClick={() => handleToggleActivo(u)} style={{
                        background: "none",
                        border: "none",
                        color: u.activo ? C.danger : C.accent,
                        cursor: "pointer",
                        fontSize: 13,
                        fontWeight: 600
                      }}>
                        {u.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* ── MODAL ABM ── */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 24 }}>
          <div style={{ background: C.white, padding: 32, borderRadius: 0, width: "100%", maxWidth: 500, maxHeight: "90vh", overflowY: "auto", boxShadow: "none" }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 24 }}>
              {editingId ? "Editar Usuario" : "Nuevo Usuario"}
            </h2>

            {formError && (
              <div style={{ background: C.dangerBg, color: C.danger, padding: 12, borderRadius: 0, fontSize: 13, marginBottom: 20, fontWeight: 600 }}>
                ⚠ {formError}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Nombre */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.textMid, marginBottom: 6 }}>Nombre completo *</label>
                <input
                  required
                  type="text"
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleChange}
                  style={{ width: "100%", padding: "10px", borderRadius: 0, border: `1px solid ${C.border}`, outline: "none", fontFamily: "inherit" }}
                />
              </div>

              {/* Email */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.textMid, marginBottom: 6 }}>Email *</label>
                <input
                  required
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  style={{ width: "100%", padding: "10px", borderRadius: 0, border: `1px solid ${C.border}`, outline: "none", fontFamily: "inherit" }}
                />
              </div>

              {/* Password */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.textMid, marginBottom: 6 }}>
                  Contraseña {editingId ? '(dejar vacío para mantener)' : '*'}
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder={editingId ? "••••••••" : "Mínimo 6 caracteres"}
                  minLength={editingId ? 0 : 6}
                  style={{ width: "100%", padding: "10px", borderRadius: 0, border: `1px solid ${C.border}`, outline: "none", fontFamily: "inherit" }}
                />
              </div>

              {/* Rol */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.textMid, marginBottom: 6 }}>Rol</label>
                <select
                  name="rol"
                  value={formData.rol}
                  onChange={handleChange}
                  style={{ width: "100%", padding: "10px", borderRadius: 0, border: `1px solid ${C.border}`, outline: "none", fontFamily: "inherit", background: C.white }}
                >
                  {ROLES.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 32, paddingTop: 20, borderTop: `1px solid ${C.border}` }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                  style={{ padding: "12px 20px", borderRadius: 0, border: `1px solid ${C.border}`, background: C.white, cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: "12px 24px",
                    borderRadius: 0,
                    border: "none",
                    background: submitting ? "#9CA3AF" : C.text,
                    color: "#fff",
                    cursor: submitting ? "not-allowed" : "pointer",
                    fontWeight: 700,
                    fontFamily: "inherit",
                    transition: "opacity 0.2s"
                  }}
                >
                  {submitting ? 'Guardando...' : (editingId ? "Guardar Cambios" : "Crear Usuario")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}