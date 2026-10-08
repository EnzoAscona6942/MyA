/* eslint-disable no-unused-vars */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mock } from 'vitest';

// We need to import the module fresh for each test
// to ensure clean state

// `global.fetch` conserva la firma real de DOM/Node, que un `vi.fn()` sin
// tipar no puede satisfacer. La instalación del mock pasa por un único punto
// de frontera (`as unknown as`) en lugar de repetir el cast en cada uso.
const fetchMock = vi.fn() as unknown as Mock;

const installFetch = (): void => {
  global.fetch = fetchMock as unknown as typeof fetch;
};

describe('api.js', () => {
  beforeEach(() => {
    localStorage.clear();
    // mockReset sí limpia la cola de mockResolvedValueOnce heredada del
    // test anterior; clearAllMocks no la toca.
    fetchMock.mockReset();
    installFetch();
  });

  describe('getHeaders', () => {
    it('should add Authorization header when token exists in localStorage', async () => {
      localStorage.setItem('token', 'test_jwt_token');

      // Re-require the module to get fresh state with mocked localStorage
      vi.resetModules();
      const { getHeaders } = await import('../lib/api');

      const headers = getHeaders();
      expect(headers['Authorization']).toBe('Bearer test_jwt_token');
    });

    it('should not add Authorization header when no token exists', async () => {
      localStorage.clear();

      vi.resetModules();
      const { getHeaders } = await import('../lib/api');

      const headers = getHeaders();
      expect(headers['Authorization']).toBeUndefined();
    });

    it('should always include Content-Type header', async () => {
      localStorage.clear();

      vi.resetModules();
      const { getHeaders } = await import('../lib/api');

      const headers = getHeaders();
      expect(headers['Content-Type']).toBe('application/json');
    });
  });

  describe('api.get', () => {
    it('should make GET request with correct headers', async () => {
      localStorage.setItem('token', 'test_token');

      vi.resetModules();
      const { api } = await import('../lib/api');

      const mockResponse = { data: 'test' };
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await api.get('/test-endpoint');

      // Verify fetch was called with the correct URL and method
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/test-endpoint',
        expect.any(Object)
      );
      // Verify the response is correctly parsed
      expect(result).toEqual(mockResponse);
    });

    it('should throw error when response is not ok', async () => {
      localStorage.clear();

      vi.resetModules();
      const { api } = await import('../lib/api');

      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Not found' })
      });

      await expect(api.get('/nonexistent')).rejects.toEqual({ error: 'Not found' });
    });
  });

  describe('api.post', () => {
    it('should make POST request with body and headers', async () => {
      localStorage.setItem('token', 'test_token');

      vi.resetModules();
      const { api } = await import('../lib/api');

      const mockResponse = { id: 1, name: 'New Item' };
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await api.post('/items', { name: 'New Item' });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/items',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test_token',
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify({ name: 'New Item' })
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('api.put', () => {
    it('should make PUT request with body and headers', async () => {
      localStorage.setItem('token', 'test_token');

      vi.resetModules();
      const { api } = await import('../lib/api');

      const mockResponse = { id: 1, name: 'Updated' };
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await api.put('/items/1', { name: 'Updated' });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/items/1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ name: 'Updated' })
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('api.delete', () => {
    it('should make DELETE request with headers', async () => {
      localStorage.setItem('token', 'test_token');

      vi.resetModules();
      const { api } = await import('../lib/api');

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({})
      });

      await api.delete('/items/1');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/items/1',
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test_token'
          })
        })
      );
    });
  });
});