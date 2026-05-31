/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useEffect, useContext } from 'react';
import { api } from '../lib/api';
import { jwtDecode } from 'jwt-decode';

export const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
    const [token, setToken] = useState(localStorage.getItem("token") || null);
    const [usuario, setUsuario] = useState(null);
    const [cajaActiva, setCajaActiva] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (token) {
            try {
                const decoded = jwtDecode(token);
                if (decoded.exp * 1000 < Date.now()) {
                    logout();
                    setLoading(false);
                    return;
                }
                setUsuario(decoded);
                localStorage.setItem("token", token);
                verificarCaja();
            } catch {
                logout();
            }
        } else {
            setLoading(false);
        }
    }, [token]);

    const verificarCaja = async () => {
        try {
            const caja = await api.get('/caja/activa');
            if (caja) {
                setCajaActiva(caja.id);
                localStorage.setItem("cajaId", caja.id);
            } else {
                setCajaActiva(null);
                localStorage.removeItem("cajaId");
            }
        } catch (e) {
            console.error("Error obteniendo caja activa:", e);
            // Por si no hay caja, API arroja 404
            setCajaActiva(null);
            localStorage.removeItem("cajaId");
        } finally {
            setLoading(false);
        }
    };

    const login = async (email, password) => {
        try {
            const data = await api.post('/auth/login', { email, password });
            setToken(data.token);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.error || 'Error al iniciar sesión' };
        }
    };

    const logout = () => {
        setToken(null);
        setUsuario(null);
        setCajaActiva(null);
        localStorage.removeItem("token");
        localStorage.removeItem("cajaId");
    };

    return (
        <AuthContext.Provider value={{ token, usuario, cajaActiva, setCajaActiva, login, logout, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
}
