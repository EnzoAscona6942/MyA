import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('admin@mya.com');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, token } = useAuth();

  if (token) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await login(email, password);
    if (!res.success) {
      setError(res.error ?? 'Error al iniciar sesión');
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#F5F5F0', fontFamily: "'DM Mono', monospace" }}>
      <div style={{ background: '#fff', padding: '40px 32px', borderRadius: 0, width: 360, boxShadow: "none" }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, borderRadius: 0, background: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 24 }}>M</span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: 0 }}>Bienvenido</h1>
          <p style={{ color: '#6B7280', fontSize: 13, marginTop: 4 }}>Ingresá tus credenciales para continuar</p>
        </div>

        {error && (
          <div style={{ background: '#FEF2F2', color: '#EF4444', padding: '12px', borderRadius: 0, fontSize: 13, fontWeight: 500, marginBottom: 20, textAlign: 'center' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4B5563', marginBottom: 6 }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 0, border: '1px solid #E5E7EB', fontSize: 14, outline: 'none', transition: 'border 0.2s', fontFamily: 'inherit' }}
              onFocus={e => e.currentTarget.style.border = '1px solid #16A34A'}
              onBlur={e => e.currentTarget.style.border = '1px solid #E5E7EB'}
              required
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4B5563', marginBottom: 6 }}>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 0, border: '1px solid #E5E7EB', fontSize: 14, outline: 'none', transition: 'border 0.2s', fontFamily: 'inherit' }}
              onFocus={e => e.currentTarget.style.border = '1px solid #16A34A'}
              onBlur={e => e.currentTarget.style.border = '1px solid #E5E7EB'}
              required
            />
          </div>

          <button
            disabled={loading}
            style={{
              width: '100%', padding: '14px', borderRadius: 0, border: 'none',
              background: loading ? '#D1D5DB' : '#16A34A', color: '#fff',
              fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s', fontFamily: 'inherit'
            }}
          >
            {loading ? 'Ingresando...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}