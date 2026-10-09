/**
 * Smoke test del módulo Login.
 *
 * Monta la página real con la API mockeada y verifica que renderiza. Con token
 * en `localStorage` la página devuelve `<Navigate to="/" replace />`, así que el
 * caso principal usa `rol: null` (sin token). El `MemoryRouter` del harness hace
 * seguro ese redirect.
 */
import { describe, it, expect } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderPage } from './helpers/renderPage';
import Login from '../pages/Login';

describe('Login - smoke de render', () => {
  it('monta el formulario de acceso sin token', async () => {
    const { container } = renderPage(<Login />, { rol: null });

    expect(await screen.findByRole('heading', { name: 'Bienvenido' })).toBeInTheDocument();
    expect(
      await screen.findByText('Ingresá tus credenciales para continuar')
    ).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Iniciar Sesión' })).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Contraseña')).toBeInTheDocument();

    // El formulario viene precargado con las credenciales de ejemplo.
    expect(screen.getByDisplayValue('admin@mya.com')).toBeInTheDocument();
    expect(container.querySelector('input[type="password"]')).toHaveValue('admin123');
  });

  it('redirige en lugar de mostrar el formulario cuando ya hay token', async () => {
    renderPage(
      <>
        <span data-testid="app-mounted">app montado</span>
        <Login />
      </>,
      { rol: 'ADMIN' }
    );

    // El hermano recién se monta cuando AuthProvider termina de resolver la
    // sesión, o sea cuando Login ya pasó por su rama de render. Sin esta espera
    // las ausencias de abajo pasarían por vacuidad.
    expect(await screen.findByTestId('app-mounted')).toBeInTheDocument();

    expect(screen.queryByRole('heading', { name: 'Bienvenido' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Iniciar Sesión' })).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('admin@mya.com')).not.toBeInTheDocument();
  });

  it('muestra el error que devuelve la API cuando las credenciales fallan', async () => {
    const { mockPost } = renderPage(<Login />, { rol: null });

    // El cliente de API rechaza con un objeto plano (`ApiError`), nunca con `Error`.
    mockPost.mockRejectedValue({ error: 'Credenciales inválidas', code: 'UNAUTHORIZED' });

    fireEvent.click(screen.getByRole('button', { name: 'Iniciar Sesión' }));

    expect(await screen.findByText('Credenciales inválidas')).toBeInTheDocument();
    expect(mockPost).toHaveBeenCalledWith('/auth/login', {
      email: 'admin@mya.com',
      password: 'admin123'
    });
  });
});