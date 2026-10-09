/**
 * Smoke test del módulo Ventas.
 *
 * Monta la página real con la API mockeada y verifica que renderiza. La página
 * tiene guarda de rol: sólo un ADMIN ve el historial, un CAJERO recibe el cartel
 * de acceso restringido.
 */
import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderPage } from './helpers/renderPage';
import Ventas from '../pages/Ventas';

const VENTA_STUB = {
  data: [
    {
      id: 42,
      fecha: '2024-05-10T15:30:00.000Z',
      subtotal: 4000,
      descuento: 0,
      total: 4000,
      metodoPago: 'EFECTIVO',
      estado: 'COMPLETADA',
      cajaId: 1,
      usuarioId: 1,
      items: [{ productoId: 1, cantidad: 2 }],
      usuario: {
        id: 1,
        nombre: 'Ana Gomez',
        email: 'ana@mya.com',
        rol: 'ADMIN',
        activo: true,
        creadoEn: ''
      }
    }
  ],
  pagination: { page: 1, limit: 20, total: 1, totalPages: 1 }
};

describe('Ventas - smoke de render', () => {
  it('monta el historial con una venta para un ADMIN', async () => {
    renderPage(<Ventas />, { stubs: { getBy: { '/ventas': VENTA_STUB } } });

    expect(await screen.findByRole('heading', { name: 'Historial de Ventas' })).toBeInTheDocument();

    // La fila del ticket: id, cajero, método y estado.
    expect(await screen.findByText('#42')).toBeInTheDocument();
    expect(await screen.findByText('Ana Gomez')).toBeInTheDocument();
    expect(await screen.findByText('EFECTIVO')).toBeInTheDocument();
    expect(await screen.findByText('COMPLETADA')).toBeInTheDocument();

    // Con una página de resultados aparecen los controles de paginación, y en la
    // primera página ambos están deshabilitados.
    expect(await screen.findByRole('button', { name: /Anterior/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Siguiente/ })).toBeDisabled();

    expect(screen.queryByText('No se encontraron ventas.')).not.toBeInTheDocument();
  });

  it('muestra el estado vacío cuando la API no devuelve ventas', async () => {
    // Ojo: si `/ventas` respondiera el array legacy, la página fuerza
    // `totalPages: 1` y la barra de paginación aparece igual con cero filas.
    // Para el estado vacío real va el sobre paginado.
    renderPage(<Ventas />, {
      stubs: {
        getBy: {
          '/ventas': { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }
        }
      }
    });

    expect(await screen.findByRole('heading', { name: 'Historial de Ventas' })).toBeInTheDocument();
    expect(await screen.findByText('No se encontraron ventas.')).toBeInTheDocument();

    // Sin páginas no hay controles de paginación.
    expect(screen.queryByRole('button', { name: /Siguiente/ })).not.toBeInTheDocument();
  });

  it('le pide la primera página al endpoint de ventas con skip y take', async () => {
    const { mockGet } = renderPage(<Ventas />, { stubs: { get: [] } });

    await waitFor(() => {
      const urls = mockGet.mock.calls.map((c) => String(c[0]));
      expect(urls.some((u) => u.startsWith('/ventas?') && u.includes('skip=0') && u.includes('take=20'))).toBe(
        true
      );
    });
  });

  it('no muestra una página vacía si el endpoint devuelve el array legacy', async () => {
    // Regresión: con el array legacy la página calculaba totalPages: 1 sin
    // mirar response.length, así que con cero filas la barra aparecía
    // diciendo "Mostrando 1 - 0 de 0 ventas". Ahora totalPages es 0 sin filas.
    renderPage(<Ventas />, { stubs: { get: [] } });

    expect(await screen.findByRole('heading', { name: 'Historial de Ventas' })).toBeInTheDocument();
    expect(await screen.findByText('No se encontraron ventas.')).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: /Siguiente/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Anterior/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Mostrando/)).not.toBeInTheDocument();
  });

  it('le oculta el historial a un CAJERO', async () => {
    renderPage(<Ventas />, { rol: 'CAJERO' });

    expect(
      await screen.findByText('Acceso restringido. Solo administradores.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Historial de Ventas' })).not.toBeInTheDocument();
  });
});