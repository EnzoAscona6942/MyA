/**
 * Smoke test del módulo AuditLog.
 *
 * Monta la página real con la API mockeada y verifica que renderiza. Ojo con la
 * forma de la respuesta: `/audit` devuelve la paginación en `meta`, NO en
 * `pagination`, así que un stub con la clave equivocada deja la tabla vacía.
 */
import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderPage } from './helpers/renderPage';
import AuditLog from '../pages/AuditLog';

const AUDIT_STUB = {
  data: [
    {
      id: 7,
      action: 'LOGIN',
      resource: 'auth',
      resourceId: null,
      details: 'Inicio de sesión correcto',
      ipAddress: '127.0.0.1',
      usuarioId: 1,
      usuario: { id: 1, nombre: 'Ana Gomez', email: 'ana@mya.com' },
      creadoEn: '2024-05-10T15:30:00.000Z'
    }
  ],
  meta: { page: 1, limit: 20, total: 1, totalPages: 1 }
};

describe('AuditLog - smoke de render', () => {
  it('monta el log de auditoría con una entrada para un ADMIN', async () => {
    renderPage(<AuditLog />, { stubs: { getBy: { '/audit': AUDIT_STUB } } });

    expect(await screen.findByRole('heading', { name: 'Log de Auditoría' })).toBeInTheDocument();

    // La fila muestra usuario, acción, recurso y detalles.
    expect(await screen.findByText('Ana Gomez')).toBeInTheDocument();
    expect(await screen.findByText('LOGIN')).toBeInTheDocument();
    expect(await screen.findByText('Inicio de sesión correcto')).toBeInTheDocument();

    // `resourceId` llega en null, así que la celda cae al guion.
    expect(await screen.findByText('auth')).toBeInTheDocument();

    // La paginación se lee desde `meta`: con una página ambos controles nacen
    // deshabilitados.
    expect(await screen.findByRole('button', { name: /Anterior/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Siguiente/ })).toBeDisabled();

    expect(screen.queryByText('No se encontraron registros.')).not.toBeInTheDocument();
  });

  it('muestra el estado vacío cuando la API no devuelve registros', async () => {
    // Ojo: si `/audit` respondiera el array legacy, la página fuerza
    // `totalPages: 1` y la barra de paginación aparece igual con cero filas.
    // Para el estado vacío real va el sobre paginado.
    renderPage(<AuditLog />, {
      stubs: {
        getBy: { '/audit': { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } } }
      }
    });

    expect(await screen.findByRole('heading', { name: 'Log de Auditoría' })).toBeInTheDocument();
    expect(await screen.findByText('No se encontraron registros.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Siguiente/ })).not.toBeInTheDocument();
  });

  it('renderiza los filtros de acción y recurso con sus opciones', async () => {
    renderPage(<AuditLog />, { stubs: { get: [] } });

    expect(await screen.findByRole('heading', { name: 'Log de Auditoría' })).toBeInTheDocument();

    expect(await screen.findByRole('option', { name: 'Todas las acciones' })).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: 'Exportar' })).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: 'Todos los recursos' })).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: 'Autenticación' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Limpiar' })).toBeInTheDocument();
  });

  it('pide el log paginando con page y limit', async () => {
    const { mockGet } = renderPage(<AuditLog />, { stubs: { get: [] } });

    await waitFor(() => {
      const urls = mockGet.mock.calls.map((c) => String(c[0]));
      expect(urls.some((u) => u.startsWith('/audit?') && u.includes('page=1') && u.includes('limit=20'))).toBe(
        true
      );
    });
  });

  it('le oculta el log a un CAJERO', async () => {
    renderPage(<AuditLog />, { rol: 'CAJERO' });

    expect(
      await screen.findByText('Acceso restringido. Solo administradores.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Log de Auditoría' })).not.toBeInTheDocument();
  });
});