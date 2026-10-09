/**
 * Smoke test del modulo Stock.
 *
 * Monta la pagina real con la API mockeada y verifica que renderiza. Si un
 * cambio futuro rompe el render, este test lo detecta antes de que llegue a
 * produccion.
 */
import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderPage } from './helpers/renderPage';
import Stock from '../pages/Stock';

describe('Stock - smoke de render', () => {
  it('monta el listado de inventario para un ADMIN', async () => {
    renderPage(<Stock />, {
      stubs: {
        getBy: {
          '/productos': [
            {
              id: 1,
              nombre: 'Aceite Girasol 1.5L',
              codigoBarras: '7791234',
              stock: 3,
              stockMinimo: 5,
              precio: 1500,
              categoria: { id: 1, nombre: 'Almacen' },
            },
          ],
          '/categorias': [{ id: 1, nombre: 'Almacen' }],
          '/proveedores': [{ id: 1, nombre: 'Distribuidora Sur' }],
        },
      },
    });

    // El header debe estar siempre.
    expect(await screen.findByRole('heading', { name: 'Control de Stock' })).toBeInTheDocument();

    // El filtro de stock bajo y el nombre del producto deben aparecer.
    expect(await screen.findByText('Ver solo Stock Bajo')).toBeInTheDocument();
    expect(await screen.findByText('Aceite Girasol 1.5L')).toBeInTheDocument();

    // Con stock 3 por debajo del minimo 5, la fila debe marcar BAJO.
    expect(await screen.findByText('BAJO')).toBeInTheDocument();
  });

  it('oculta la pestana de ingreso a un CAJERO', async () => {
    renderPage(<Stock />, { rol: 'CAJERO' });

    expect(await screen.findByRole('heading', { name: 'Control de Stock' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Nuevo Ingreso/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Vista de Inventario/i })).toBeInTheDocument();
  });

  it('muestra el estado vacio cuando no hay productos', async () => {
    renderPage(<Stock />, { stubs: { get: [] } });

    expect(
      await screen.findByText('No se encontraron productos')
    ).toBeInTheDocument();
  });

  it('pide categorias y proveedores al montar', async () => {
    const { mockGet } = renderPage(<Stock />, { stubs: { get: [] } });

    await waitFor(() => {
      const urls = mockGet.mock.calls.map((c) => String(c[0]));
      expect(urls.some((u) => u.startsWith('/categorias'))).toBe(true);
      expect(urls.some((u) => u.startsWith('/proveedores'))).toBe(true);
    });
  });
});