/**
 * Smoke test del módulo Usuarios.
 *
 * Monta la página real con la API mockeada y verifica que renderiza. Toda la
 * gestión de usuarios es exclusiva de un ADMIN: un CAJERO recibe un cartel de
 * acceso restringido en lugar del listado.
 */
import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderPage } from './helpers/renderPage';
import Usuarios from '../pages/Usuarios';

const USUARIOS_STUB = [
  {
    id: 1,
    nombre: 'Ana Gomez',
    email: 'ana@mya.com',
    rol: 'ADMIN',
    activo: true,
    creadoEn: '2024-01-01T00:00:00.000Z'
  },
  {
    id: 2,
    nombre: 'Beto Ruiz',
    email: 'beto@mya.com',
    rol: 'CAJERO',
    activo: false,
    creadoEn: '2024-02-01T00:00:00.000Z'
  }
];

describe('Usuarios - smoke de render', () => {
  it('monta el listado de usuarios para un ADMIN', async () => {
    renderPage(<Usuarios />, { stubs: { getBy: { '/usuarios': USUARIOS_STUB } } });

    expect(await screen.findByRole('heading', { name: 'Gestión de Usuarios' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Nuevo Usuario' })).toBeInTheDocument();

    // Un usuario activo con sus acciones.
    expect(await screen.findByText('Ana Gomez')).toBeInTheDocument();
    expect(await screen.findByText('ana@mya.com')).toBeInTheDocument();
    expect(await screen.findByText('Activo')).toBeInTheDocument();
    expect(await screen.findByText('Desactivar')).toBeInTheDocument();

    // Un usuario inactivo ofrece la acción inversa.
    expect(await screen.findByText('Inactivo')).toBeInTheDocument();
    expect(await screen.findByText('Activar')).toBeInTheDocument();

    expect(screen.queryByText('No se encontraron usuarios.')).not.toBeInTheDocument();
  });

  it('muestra el estado vacío cuando la API no devuelve usuarios', async () => {
    renderPage(<Usuarios />, { stubs: { get: [] } });

    expect(await screen.findByRole('heading', { name: 'Gestión de Usuarios' })).toBeInTheDocument();
    expect(await screen.findByText('No se encontraron usuarios.')).toBeInTheDocument();
  });

  it('pide el listado de usuarios al montar', async () => {
    const { mockGet } = renderPage(<Usuarios />, { stubs: { get: [] } });

    await waitFor(() => {
      const urls = mockGet.mock.calls.map((c) => String(c[0]));
      expect(urls.some((u) => u.startsWith('/usuarios'))).toBe(true);
    });
  });

  it('le oculta la gestión de usuarios a un CAJERO', async () => {
    renderPage(<Usuarios />, { rol: 'CAJERO' });

    expect(await screen.findByRole('heading', { name: 'Acceso restringido' })).toBeInTheDocument();
    expect(
      await screen.findByText('Solo los administradores pueden gestionar usuarios.')
    ).toBeInTheDocument();

    expect(screen.queryByRole('heading', { name: 'Gestión de Usuarios' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Nuevo Usuario' })).not.toBeInTheDocument();
  });
});