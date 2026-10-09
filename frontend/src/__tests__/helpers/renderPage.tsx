/**
 * Harness compartido para los smoke tests de las paginas.
 *
 * El objetivo NO es probar la logica de negocio: es detectar que una pagina
 * revienta al montarse. Hoy las ocho paginas tienen 0% de coverage, y todos
 * los bugs que aparecieron durante la migracion (el filtro de fechas de
 * Ventas, la paginacion muerta de AuditLog, la categoria vacia al editar en
 * Productos) se encontraron leyendo codigo, no con tests.
 */
import { render, type RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, type Mock } from 'vitest';
import { ReactNode } from 'react';
import { AuthProvider } from '../../context/AuthContext';
import { api } from '../../lib/api';

// El cliente HTTP nunca debe tocar la red en un smoke test. Este mock es de
// modulo, asi que AuthProvider y las paginas comparten la misma instancia.
vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  API_URL: 'http://localhost:3001/api',
  getHeaders: () => ({ 'Content-Type': 'application/json' }),
}));

// Si hay token, AuthProvider decodifica el JWT para armar el usuario.
// vi.hoisted es necesario porque vi.mock se hoistea arriba de todo: la
// factory no puede cerrar sobre variables normales del modulo. Sin esto el
// mock devolvia siempre ADMIN y el caso CAJERO era indistinguible.
const authState = vi.hoisted((): { rol: string } => ({ rol: 'ADMIN' }));

vi.mock('jwt-decode', () => ({
  jwtDecode: vi.fn(() => ({
    id: 1,
    nombre: 'Test User',
    rol: authState.rol,
    exp: Math.floor(Date.now() / 1000) + 3600,
  })),
}));

const mockGet = api.get as unknown as Mock;
const mockPost = api.post as unknown as Mock;
const mockPut = api.put as unknown as Mock;
const mockDelete = api.delete as unknown as Mock;

export type Rol = 'ADMIN' | 'CAJERO';

export interface ApiStubs {
  /** Valor por defecto para cualquier api.get no listado. */
  get?: unknown;
  /** Respuestas por endpoint: '/ventas' -> valor. */
  getBy?: Record<string, unknown>;
}

export interface RenderPageOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Rol con el que se autentica. Sin rol no hay token y las pestañas de admin se ocultan. */
  rol?: Rol | null;
  stubs?: ApiStubs;
}

/**
 * Monta un componente con Router y AuthProvider, y deja la API mockeada.
 * Devuelve ademas los mocks para poder ajustar una llamada puntual.
 */
export function renderPage(ui: ReactNode, options: RenderPageOptions = {}) {
  const { rol = 'ADMIN', stubs = {}, ...rest } = options;

  localStorage.clear();
  authState.rol = rol ?? 'ADMIN';
  if (rol) {
    localStorage.setItem('token', 'test_token');
  }

  mockGet.mockReset();
  mockPost.mockReset();
  mockPut.mockReset();
  mockDelete.mockReset();

  const defaultGet = stubs.get ?? [];
  mockGet.mockImplementation((url: string) => {
    const key = Object.keys(stubs.getBy ?? {}).find((k) => url.startsWith(k));
    return Promise.resolve(key ? stubs.getBy?.[key] : defaultGet);
  });
  mockPost.mockResolvedValue({});
  mockPut.mockResolvedValue({});
  mockDelete.mockResolvedValue({});

  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter>
      <AuthProvider>{children}</AuthProvider>
    </MemoryRouter>
  );

  const result = render(ui, { wrapper, ...rest });

  return {
    ...result,
    mockGet,
    mockPost,
    mockPut,
    mockDelete,
  };
}