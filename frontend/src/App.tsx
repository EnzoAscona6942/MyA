import { Component, type ErrorInfo, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import MainApp from './pages/POS';

// ── Error Boundary para capturar errores de renderizado ───────
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('React Error Boundary:', error, info);
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, fontFamily: 'monospace' }}>
          <h2 style={{ color: '#EF4444' }}>Error en la aplicación</h2>
          <pre style={{ background: '#1a1a1a', color: '#f5f5f5', padding: 20, borderRadius: 8, overflow: 'auto', marginTop: 16 }}>
            {this.state.error?.message || 'Error desconocido'}
          </pre>
          <button onClick={() => { localStorage.clear(); window.location.href = '/login'; }}
            style={{ marginTop: 16, padding: '10px 20px', background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
            Volver al Login
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { token, loading } = useAuth();
  if (loading) return null; // o un spinner
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/*" element={
              <ProtectedRoute>
                <MainApp />
              </ProtectedRoute>
            } />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}