/* eslint-disable no-unused-vars, react-hooks/globals */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../context/AuthContext';

// Mock jwt-decode
vi.mock('jwt-decode', () => ({
  jwtDecode: vi.fn((token) => {
    if (token === 'expired_token') {
      throw new Error('Token expired');
    }
    return { id: 1, nombre: 'Test User', rol: 'CAJERO', exp: Math.floor(Date.now() / 1000) + 3600 };
  }),
}));

// Mock api
vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { api } from '../lib/api';

// El módulo está mockeado, pero `api` conserva su firma genérica real.
const mockApiGet = api.get as unknown as Mock;
const mockApiPost = api.post as unknown as Mock;

type AuthValue = ReturnType<typeof useAuth>;

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    // mockReset limpia también la cola de mockResolvedValueOnce heredada
    // del test anterior; clearAllMocks no la toca.
    mockApiGet.mockReset();
    mockApiPost.mockReset();
  });

  /**
   * Monta el provider y devuelve un proxy que lee el contexto VIVO.
   *
   * El provider construye un objeto de contexto nuevo en cada render, así
   * que devolver el valor capturado en el momento del mount haría que el
   * test quedara con un snapshot obsoleto: `logout()` se ejecutaría
   * correctamente pero las aserciones seguirían viendo el estado previo.
   */
  const getContextValue = async (withToken = false): Promise<AuthValue> => {
    let current: AuthValue | undefined;

    function TestComponent() {
      current = useAuth();
      return null;
    }

    // Mock the initial caja check
    mockApiGet.mockResolvedValueOnce({ id: 1 });

    if (withToken) {
      localStorage.setItem('token', 'valid_jwt_token');
    }

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => expect(current!.loading).toBe(false));

    return new Proxy({} as AuthValue, {
      get: (_target, prop: string) =>
        (current as unknown as Record<string, unknown>)[prop],
    });
  };

  describe('login', () => {
    it('should update user state when login is successful', async () => {
      const mockResponse = {
        token: 'valid_jwt_token',
        refreshToken: 'refresh_token',
        usuario: { id: 1, nombre: 'Test User', email: 'test@test.com', rol: 'CAJERO' }
      };

      mockApiPost.mockResolvedValueOnce(mockResponse);

      const context = await getContextValue(false);

      const result = await context.login('test@test.com', 'password123');

      expect(result.success).toBe(true);
      expect(mockApiPost).toHaveBeenCalledWith('/auth/login', {
        email: 'test@test.com',
        password: 'password123'
      });
    });

    it('should return error when login fails', async () => {
      mockApiPost.mockRejectedValueOnce({ error: 'Invalid credentials' });

      const context = await getContextValue(false);

      const result = await context.login('wrong@test.com', 'wrongpass');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });
  });

  describe('logout', () => {
    it('should clear user state when logout is called', async () => {
      const context = await getContextValue(true);

      // Verify user is loaded from token
      expect(context.usuario).not.toBeNull();
      expect(context.token).toBe('valid_jwt_token');

      act(() => {
        context.logout();
      });

      await waitFor(() => {
        expect(context.usuario).toBeNull();
        expect(context.token).toBeNull();
        expect(context.cajaActiva).toBeNull();
      });
      expect(localStorage.getItem('token')).toBeNull();
    });
  });

  describe('loading state', () => {
    it('should provide loading state during authentication check', async () => {
      const context = await getContextValue(true);

      // Initially loading should be false after initial render completes
      expect(context.loading).toBe(false);
    });
  });
});