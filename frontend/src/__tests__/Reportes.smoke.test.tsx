/**
 * Smoke test del módulo Reportes.
 *
 * Monta la página real con la API mockeada y verifica que renderiza. La página
 * no pide datos hasta que el rango de fechas por defecto (últimos 7 días) queda
 * seteado, así que las aserciones usan `findBy*` para esperar ese efecto.
 */
import { describe, it, expect } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderPage } from './helpers/renderPage';
import Reportes from '../pages/Reportes';

describe('Reportes - smoke de render', () => {
  it('monta el reporte del día con ventas, métodos de pago y tickets', async () => {
    renderPage(<Reportes />, {
      stubs: {
        getBy: {
          '/reportes/ventas-hoy': {
            totalVentas: 125000,
            totalDescuentos: 5000,
            cantidadTransacciones: 8,
            ventasPorMetodo: [{ metodoPago: 'EFECTIVO', _sum: { total: 100000 }, _count: { id: 5 } }],
            ultimasVentas: [{ id: 42, fecha: '2024-05-10T15:30:00.000Z', total: 4200 }]
          },
          '/reportes/ventas-por-dia': [{ dia: '2024-05-10', cantidad_ventas: 8, total: '125000' }],
          '/reportes/stock': { totalProductos: 42, stockBajo: 3, sinStock: 1, productosBajoStock: [] }
        }
      }
    });

    expect(await screen.findByRole('heading', { name: 'Reportes y Metricas' })).toBeInTheDocument();

    // El desglose por método de pago existe y ya no se muestra el placeholder.
    expect(await screen.findByText('EFECTIVO (5 tickets)')).toBeInTheDocument();
    expect(screen.queryByText('Sin datos de métodos de pago hoy.')).not.toBeInTheDocument();

    // El ticket más reciente se lista con el id cuadrado a 6 dígitos.
    expect(await screen.findByText('000042')).toBeInTheDocument();
    expect(screen.queryByText('No se han emitido tickets en el día de hoy.')).not.toBeInTheDocument();

    // El resumen de stock bajo solo aparece si /reportes/stock respondió.
    expect(await screen.findByText('3 productos bajos')).toBeInTheDocument();

    // Con ventas por día cargadas, el gráfico reemplaza su estado vacío.
    expect(
      screen.queryByText('No hay ventas registradas en las fechas seleccionadas.')
    ).not.toBeInTheDocument();
  });

  it('muestra el estado vacío cuando la API no devuelve ventas ni tickets', async () => {
    renderPage(<Reportes />, {
      stubs: {
        getBy: {
          '/reportes/ventas-hoy': null,
          '/reportes/ventas-por-dia': [],
          '/reportes/stock': null
        }
      }
    });

    expect(await screen.findByRole('heading', { name: 'Reportes y Metricas' })).toBeInTheDocument();

    expect(
      await screen.findByText('No hay ventas registradas en las fechas seleccionadas.')
    ).toBeInTheDocument();
    expect(await screen.findByText('Sin datos de métodos de pago hoy.')).toBeInTheDocument();
    expect(
      await screen.findByText('No se han emitido tickets en el día de hoy.')
    ).toBeInTheDocument();

    // Sin resumen del día no se dibuja el bloque de tarjetas.
    expect(screen.queryByText('Ventas de Hoy')).not.toBeInTheDocument();
  });

  it('pide los tres endpoints de reportes al montar', async () => {
    const { mockGet } = renderPage(<Reportes />, { stubs: { get: [] } });

    await waitFor(() => {
      const urls = mockGet.mock.calls.map((c) => String(c[0]));
      expect(urls.some((u) => u.startsWith('/reportes/ventas-hoy'))).toBe(true);
      expect(urls.some((u) => u.startsWith('/reportes/ventas-por-dia'))).toBe(true);
      expect(urls.some((u) => u.startsWith('/reportes/stock'))).toBe(true);
    });
  });

  it('vuelve a pedir el histórico cuando cambia el rango de fechas', async () => {
    const { container, mockGet } = renderPage(<Reportes />, { stubs: { get: [] } });

    // Los filtros viven en el header, que sólo existe cuando AuthProvider ya
    // terminó de resolver la sesión y Reportes llegó a montar.
    expect(await screen.findByRole('heading', { name: 'Reportes y Metricas' })).toBeInTheDocument();

    // Los dos `input[type="date"]` no tienen `id`, así que no hay label asociado.
    const fechas = Array.from(container.querySelectorAll('input[type="date"]'));
    const campoDesde = fechas.at(0);
    if (!campoDesde) throw new Error('Reportes no renderizó los filtros de fecha');

    fireEvent.change(campoDesde, { target: { value: '2024-01-01' } });

    await waitFor(() => {
      const urls = mockGet.mock.calls.map((c) => String(c[0]));
      expect(
        urls.some(
          (u) => u.startsWith('/reportes/ventas-por-dia') && u.includes('desde=2024-01-01')
        )
      ).toBe(true);
    });
  });
});