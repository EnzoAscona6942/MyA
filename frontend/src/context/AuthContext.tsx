// ============================================================
// AUTH CONTEXT - TypeScript
// ============================================================

import { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { api } from '../lib/api';
import { jwtDecode } from 'jwt-decode';
import type { Usuario, Caja } from '../types/api';

interface JwtPayload {
  id: number;
  nombre: string;
  rol: 'ADMIN' | 'CAJERO';
  exp: number;
}

interface AuthContextValue {
  token: string | null;
  usuario: Usuario | null;
  cajaActiva: number | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  loading: boolean;
  setCajaActiva: (id: number | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token') || null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cajaActiva, setCajaActiva] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      try {
        const decoded = jwtDecode<JwtPayload>(token);
        if (decoded.exp * 1000 < Date.now()) {
          logout();
          setLoading(false);
          return;
        }
        setUsuario({
          id: decoded.id,
          nombre: decoded.nombre,
          email: '',
          rol: decoded.rol,
          activo: true,
          creadoEn: ''
        });
        localStorage.setItem('token', token);
        verificarCaja();
      } catch {
        logout();
      }
    } else {
      setLoading(false);
    }
  }, [token]);

  const verificarCaja = async (): Promise<void> => {
    try {
      const caja = await api.get<Caja>('/caja/activa');
      if (caja) {
        setCajaActiva(caja.id);
        localStorage.setItem('cajaId', String(caja.id));
      } else {
        setCajaActiva(null);
        localStorage.removeItem('cajaId');
      }
    } catch (e) {
      console.error('Error obteniendo caja activa:', e);
      setCajaActiva(null);
      localStorage.removeItem('cajaId');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const data = await api.post<{ token: string; refreshToken: string; usuario: Usuario }>('/auth/login', { email, password });
      setToken(data.token);
      return { success: true };
    } catch (error: unknown) {
      const err = error as { error?: string };
      return { success: false, error: err.error || 'Error al iniciar sesión' };
    }
  };

  const logout = (): void => {
    setToken(null);
    setUsuario(null);
    setCajaActiva(null);
    localStorage.removeItem('token');
    localStorage.removeItem('cajaId');
  };

  return (
    <AuthContext.Provider value={{ token, usuario, cajaActiva, setCajaActiva, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}