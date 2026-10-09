/**
 * Smoke test del módulo POS.
 *
 * Monta el shell real (el default export de `pages/POS`, que es `MainApp`) con
 * la API mockeada y verifica que renderiza. `MainApp` arranca en el módulo
 * `pos`, así que el sidebar y el panel de venta están montados desde el inicio.
 */
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderPage } from './helpers/renderPage';
import MainApp from '../pages/POS';

const PRODUCTOS_STUB = {
  data: [
    {
      id: 1,
      nombre: 'Aceite Girasol 1.5L',
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
    },
    {
      id: 2,
      nombre: 'Fideos Espagueti 500g',
      codigoBarras: '7795678',
      precio: 950,
      stock: 3,
      stockMinimo: 5,
      unidadMedida: 'UN',
      activo: true,
      categoriaId: 1,
      categoria: { id: 1, nombre: 'Almacen', descripcion: null, creadoEn: '' },
      creadoEn: '',
      actualizadoEn: ''
    }
  ]
};

describe('POS - smoke de render', () => {
  it('monta el shell con el módulo de venta y el carrito vacío', async () => {
    renderPage(<MainApp />, { stubs: { get: [] } });

    expect(await screen.findByRole('heading', { name: 'Punto de Venta' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Carrito' })).toBeInTheDocument();

    // El sidebar lista los ocho módulos de la app.
    expect(screen.getByText('Minimercado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Caja / POS' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cierre de Caja' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Auditoría' })).toBeInTheDocument();

    // Carrito sin ítems: mensaje de carrito vacío y botón de cobrar deshabilitado.
    expect(await screen.findByText(/Escaneá un producto/)).toBeInTheDocument();
    expect(screen.getByText('Productos frecuentes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cobrar' })).toBeDisabled();
    expect(screen.getByText('Scanner listo')).toBeInTheDocument();
  });

  it('lista los productos frecuentes que devuelve la API', async () => {
    renderPage(<MainApp />, { stubs: { getBy: { '/productos': PRODUCTOS_STUB } } });

    expect(await screen.findByRole('heading', { name: 'Punto de Venta' })).toBeInTheDocument();

    // Las tarjetas de frecuentes se llenan desde /productos.
    expect(await screen.findByText('Aceite Girasol 1.5L')).toBeInTheDocument();
    expect(await screen.findByText('Fideos Espagueti 500g')).toBeInTheDocument();

    // El carrito sigue vacío: los frecuentes no se agregan solos.
    expect(screen.getByRole('button', { name: 'Cobrar' })).toBeDisabled();
  });

  it('refleja el rol del usuario en el sidebar', async () => {
    const { unmount } = renderPage(<MainApp />, { rol: 'ADMIN', stubs: { get: [] } });

    expect(await screen.findByText('ADMIN')).toBeInTheDocument();
    unmount();

    renderPage(<MainApp />, { rol: 'CAJERO', stubs: { get: [] } });

    // El sidebar imprime el rol del JWT decodificado, así que el cambio es visible.
    expect(await screen.findByText('CAJERO')).toBeInTheDocument();
    expect(screen.queryByText('ADMIN')).not.toBeInTheDocument();
  });
});