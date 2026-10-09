/**
 * Smoke test del módulo Productos.
 *
 * Monta la página real con la API mockeada y verifica que renderiza. La página
 * consume `useChunkedUpload`, que lee `API_URL` y `getHeaders` de `../lib/api`:
 * el harness mockea ambos, así que el hook debe montar en estado `idle` y el
 * botón de carga masiva tiene que quedar habilitado.
 */
import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderPage } from './helpers/renderPage';
import Productos from '../pages/Productos';

const PRODUCTOS_STUB = {
  data: [
    {
      id: 1,
      nombre: 'Aceite Girasol 1.5L',
      descripcion: 'Aceite vegetal',
      codigoBarras: '7791234',
      precio: 1500,
      stock: 12,
      stockMinimo: 5,
      unidadMedida: 'UN',
      activo: true,
      categoriaId: 1,
      categoria: { id: 1, nombre: 'Almacen', descripcion: null, creadoEn: '' },
      creadoEn: '',
      actualizadoEn: ''
    }
  ],
  pagination: { page: 1, limit: 20, total: 1, totalPages: 1 }
};

describe('Productos - smoke de render', () => {
  it('monta el catálogo con el hook de carga masiva en idle', async () => {
    renderPage(<Productos />, {
      stubs: {
        getBy: {
          '/productos': PRODUCTOS_STUB,
          '/categorias': [{ id: 1, nombre: 'Almacen', descripcion: null, creadoEn: '' }]
        }
      }
    });

    expect(await screen.findByRole('heading', { name: 'Catálogo de Productos' })).toBeInTheDocument();

    // Si `useChunkedUpload` no pudiera resolver `API_URL`/`getHeaders` y revienta
    // al montar, la página entera no llegaría a renderizar estos botones.
    expect(screen.getByRole('button', { name: /Carga Excel\/CSV/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: '+ Nuevo Producto' })).toBeInTheDocument();

    // La fila del producto: código, nombre, categoría y acciones.
    expect(await screen.findByText('7791234')).toBeInTheDocument();
    expect(await screen.findByText('Aceite Girasol 1.5L')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Almacen' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Borrar' })).toBeInTheDocument();

    // El filtro de categorías se llena con lo que devuelve /categorias.
    expect(await screen.findByRole('option', { name: 'Almacen' })).toBeInTheDocument();

    expect(screen.queryByText('No se encontraron registros.')).not.toBeInTheDocument();
  });

  it('muestra el estado vacío cuando la API no devuelve productos', async () => {
    renderPage(<Productos />, { stubs: { get: [] } });

    expect(await screen.findByRole('heading', { name: 'Catálogo de Productos' })).toBeInTheDocument();
    expect(await screen.findByText('No se encontraron registros.')).toBeInTheDocument();
  });

  it('pide productos y categorías al montar', async () => {
    const { mockGet } = renderPage(<Productos />, { stubs: { get: [] } });

    await waitFor(() => {
      const urls = mockGet.mock.calls.map((c) => String(c[0]));
      expect(urls.some((u) => u.startsWith('/productos?'))).toBe(true);
      expect(urls.some((u) => u.startsWith('/categorias'))).toBe(true);
    });
  });

  it('le oculta el catálogo a un CAJERO', async () => {
    renderPage(<Productos />, { rol: 'CAJERO' });

    expect(
      await screen.findByText('Acceso restringido. Solo administradores.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Catálogo de Productos' })).not.toBeInTheDocument();
  });
});