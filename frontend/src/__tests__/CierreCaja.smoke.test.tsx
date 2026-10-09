/**
 * Smoke test del módulo CierreCaja.
 *
 * Monta la página real con la API mockeada y verifica que renderiza. La página
 * tiene dos ramas: con caja activa muestra el dashboard, sin caja activa
 * muestra el formulario de apertura. El backend responde 404 cuando no hay
 * caja abierta, así que ese estado se stubbea como rechazo, no como `null`.
 */
import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderPage } from './helpers/renderPage';
import CierreCaja from '../pages/CierreCaja';

const CAJA_STUB = {
  id: 1,
  fechaApertura: '2024-05-10T08:00:00.000Z',
  fechaCierre: null,
  montoInicial: 50000,
  montoFinalReal: null,
  estado: 'ABIERTA',
  usuarioId: 1,
  usuario: { nombre: 'Ana Gomez' },
  movimientos: [],
  totalVentas: 87500,
  cantidadVentas: 3
};

describe('CierreCaja - smoke de render', () => {
  it('monta el dashboard con la caja activa', async () => {
    renderPage(<CierreCaja />, { stubs: { getBy: { '/caja/activa': CAJA_STUB } } });

    expect(await screen.findByRole('heading', { name: 'Caja Activa' })).toBeInTheDocument();

    // El encabezado nombra al cajero que abrió el turno.
    expect(await screen.findByText(/por Ana Gomez/)).toBeInTheDocument();

    // Los totales y el panel de cierre están siempre presentes.
    expect(await screen.findByText('Total Facturado (Tickets: 3)')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cerrar Turno' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Movimiento Manual' })).toBeInTheDocument();

    // Sin movimientos manuales: la lista muestra su propio estado vacío.
    expect(
      await screen.findByText('No hay movimientos manuales registrados en este turno.')
    ).toBeInTheDocument();
  });

  it('lista los movimientos manuales del turno', async () => {
    renderPage(<CierreCaja />, {
      stubs: {
        getBy: {
          '/caja/activa': {
            ...CAJA_STUB,
            movimientos: [
              {
                id: 3,
                tipo: 'EGRESO',
                monto: 2500,
                descripcion: 'Compra de insumos de limpieza',
                fecha: '2024-05-10T12:00:00.000Z',
                cajaId: 1
              }
            ]
          }
        }
      }
    });

    expect(await screen.findByRole('heading', { name: 'Caja Activa' })).toBeInTheDocument();
    expect(await screen.findByText('Compra de insumos de limpieza')).toBeInTheDocument();
    expect(
      screen.queryByText('No hay movimientos manuales registrados en este turno.')
    ).not.toBeInTheDocument();
  });

  it('pide la caja activa al montar', async () => {
    const { mockGet } = renderPage(<CierreCaja />, { stubs: { get: [] } });

    await waitFor(() => {
      const urls = mockGet.mock.calls.map((c) => String(c[0]));
      expect(urls.some((u) => u.startsWith('/caja/activa'))).toBe(true);
    });
  });

  it('muestra el formulario de apertura cuando no hay caja activa', async () => {
    const { mockGet } = renderPage(<CierreCaja />, { stubs: { get: [] } });

    // `GET /caja/activa` responde 404 cuando no hay caja abierta, y el cliente de
    // API rechaza. La página y el AuthProvider manejan ese rechazo.
    mockGet.mockRejectedValue({ error: 'No hay una caja abierta', code: 'NOT_FOUND' });

    expect(await screen.findByRole('heading', { name: 'Abrir Turno' })).toBeInTheDocument();
    expect(
      await screen.findByText('Ingresa el dinero inicial en la caja chica.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir Caja' })).toBeInTheDocument();
    expect(screen.getByText('Monto Inicial Efectivo ($)')).toBeInTheDocument();

    expect(screen.queryByRole('heading', { name: 'Caja Activa' })).not.toBeInTheDocument();
  });
});