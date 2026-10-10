/**
 * Contrato de caja activa en el POS.
 *
 * El POS cobra con `POST /ventas`, que exige una caja abierta. Antes tomaba
 * `localStorage.cajaId || '1'`, asi que una sesion sin caja cargaba contra la
 * caja 1 (que puede no existir, o existir cerrada). Y el catch leia `message`
 * de un objeto plano `{ error, code }` — no de una `Error` — por lo que todo
 * fallo se mostraba como "Error desconocido".
 *
 * Estos tests fijan las consecuencias observables de resolver la caja contra
 * `GET /caja/activa`: sin caja no se cobra, con caja se cobra contra el id
 * RESUELTO (no contra el 1), y un rechazo del backend muestra su mensaje.
 *
 * Hay dos niveles, y los dos hacen falta:
 *
 * - End-to-end (`renderPage` + `MainApp` + el modal de pago real): es el unico
 *   que atraviesa el cableado completo del cobro, y por lo tanto el unico que
 *   puede volver a capturar el bug de `handleConfirmarPago` — el wrapper que
 *   descartaba el payload del modal y re-validaba contra un estado del hook
 *   que nadie actualizaba, dejando el POST sin salir nunca. Ese fallo era
 *   invisible: la UI se veia bien, el modal abria, y nada mas.
 * - Hook (`renderHook` + `usePOSLogic`): cubre los caminos de `confirmarCobro`
 *   que no se pueden alcanzar desde la UI — sobre todo el POST bloqueado sin
 *   caja, que la UI impide mediante el boton deshabilitado. Ahi el gate es
 *   defensa en profundidad y solo se llega llamando al hook directo.
 *
 * No fusionar los dos: el end-to-end falla si el cableado se rompe, y los de
 * hook fallan si la guarda interna se rompe.
 */
import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor, fireEvent, renderHook, act, within } from '@testing-library/react';
import { renderPage, type ApiStubs } from './helpers/renderPage';
import { AuthProvider } from '../context/AuthContext';
import { usePOSLogic } from '../pages/pos/logic';
import MainApp from '../pages/POS';
import type { ReactNode } from 'react';

const PRODUCTO_STUB = {
  data: [
    {
      id: 10,
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
    }
  ]
};

// `id: 7` a proposito: si el payload sale con `cajaId: 1`, el test falla.
const CAJA_STUB = {
  id: 7,
  fechaApertura: '2026-05-10T08:00:00.000Z',
  fechaCierre: null,
  montoInicial: 50000,
  montoFinalReal: null,
  estado: 'ABIERTA',
  usuarioId: 1,
  totalVentas: 0,
  cantidadVentas: 0
};

const AVISO_SIN_CAJA = 'No hay una caja abierta. Abrí caja para poder cobrar.';

// Fabrica, no constante: la promesa rechazada tiene que crearse cuando el test
// la usa. Si viviera en el scope del modulo, `Promise.reject` quedaria sin
// handler hasta que corra el primer test y Vitest la reportaria como
// unhandled rejection.
// El 404 real de `GET /caja/activa` manda `{ error }` y NO `code`. El harness
// resuelve cada stub con `Promise.resolve`, asi que una promesa ya rechazada
// conserva su estado y el endpoint rechaza de verdad — sin tocar el harness.
const stubSinCaja = (): ApiStubs => ({
  get: [],
  getBy: { '/caja/activa': Promise.reject({ error: 'No hay una caja abierta' }) }
});

const STUB_CON_CAJA: ApiStubs = {
  get: [],
  getBy: { '/productos': PRODUCTO_STUB, '/caja/activa': CAJA_STUB }
};

// ── Helpers ──────────────────────────────────────────────────

// Agrega el frecuente al carrito. El texto vive dentro del <button> de la
// tarjeta, asi que se sube al boton antes de hacer click.
const agregarAlCarrito = async (): Promise<void> => {
  const tarjeta = (await screen.findByText('Aceite Girasol 1.5L')).closest('button');
  if (!(tarjeta instanceof HTMLElement)) {
    throw new Error('La tarjeta del frecuente no se renderizó como botón');
  }
  fireEvent.click(tarjeta);
};

type POSLogic = ReturnType<typeof usePOSLogic>;

// `result.current` arranca en `null` y no en `undefined`: `AuthProvider`
// renderiza `{!loading && children}`, asi que hasta que resuelve la sesion el
// hook no existe. Un guard con `undefined` dejaria pasar ese `null` en
// silencio, por eso el acceso pasa por acá.
type HookResultado = { current: POSLogic | null };

const logica = (result: HookResultado): POSLogic => {
  if (!result.current) throw new Error('El hook de POS no está montado');
  return result.current;
};

// `renderPage` tambien sirve como configurador de mocks: monta un fragmento en
// lugar del POS, asi que no dispara ningun GET propio y los mocks quedan
// limpios para que los consuma `renderHook`.
const montarPOS = async (
  stubs: ApiStubs
): Promise<{ result: HookResultado; mockPost: ReturnType<typeof vi.fn> }> => {
  const { mockPost } = renderPage(<></>, { stubs });

  const { result } = renderHook(() => usePOSLogic(), {
    wrapper: ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>
  });

  await waitFor(() => {
    expect(result.current).toBeTruthy();
  });

  return { result, mockPost };
};

// Lleva el hook hasta `confirmarCobro`. Se relee en cada paso a proposito:
// `confirmarCobro` se recrea en cada render y cierra sobre el estado de ese
// render, asi que invocar la copia guardada antes del ultimo `act` usaria un
// `cajaActivaId` viejo.
const cobrarDesdeElHook = async (result: HookResultado): Promise<void> => {
  await act(async () => {
    await logica(result).confirmarCobro({
      metodo: 'TARJETA_DEBITO',
      montoRecibido: 0,
      vuelto: 0
    });
  });
};

// El modal de pago no declara `role="dialog"` ni un label asociado al input, asi
// que se localiza por su encabezado y se acota con `within`. Eso hace falta
// ademas porque el boton del carrito y el del modal dicen los dos
// "Cobrar $ 1.500": sin acotar, la consulta es ambigua.
const modalDePago = async (): Promise<HTMLElement> => {
  const titulo = await screen.findByRole('heading', { name: 'Confirmar pago' });
  const modal = titulo.closest('div');
  if (!(modal instanceof HTMLElement)) {
    throw new Error('El modal de pago no se montó como un <div>');
  }
  return modal;
};

// ══════════════════════════════════════════════════════════════
// (a) Sin caja activa, no se cobra
// ══════════════════════════════════════════════════════════════
describe('POS - cobro sin caja activa', () => {
  it('bloquea el cobro en la UI y no llama a la API cuando no hay caja abierta', async () => {
    // Una sola llamada: `stubSinCaja()` crea una promesa rechazada nueva cada
    // vez, y descartar una sin handler la deja como unhandled rejection.
    const sinCaja = stubSinCaja();
    const { mockGet, mockPost } = renderPage(<MainApp />, {
      stubs: { ...sinCaja, getBy: { ...sinCaja.getBy, '/productos': PRODUCTO_STUB } }
    });

    await waitFor(() => {
      const urls = mockGet.mock.calls.map((c) => String(c[0]));
      expect(urls.some((u) => u.startsWith('/caja/activa'))).toBe(true);
    });

    await agregarAlCarrito();

    // El 404 es estado normal del POS, no un error de UI: avisa y apaga cobrar.
    expect(await screen.findByText(AVISO_SIN_CAJA)).toBeInTheDocument();

    // El carrito tiene el item, asi que la unica razon para apagarlo es la caja.
    const cobrar = screen.getByRole('button', { name: /^Cobrar/ });
    expect(cobrar).toBeDisabled();

    fireEvent.click(cobrar);

    // Ni se abre el modal, ni sale la request.
    expect(screen.queryByRole('heading', { name: 'Confirmar pago' })).not.toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('no manda la venta cuando la caja activa no se resolvió', async () => {
    const { result, mockPost } = await montarPOS(stubSinCaja());

    await waitFor(() => {
      expect(logica(result).cajaActivaId).toBeNull();
    });
    expect(logica(result).cajaActivaMsg).toBe(AVISO_SIN_CAJA);

    await cobrarDesdeElHook(result);

    // Corta antes del POST: sin caja contra que registrar la venta no hay
    // request que valga, solo el aviso.
    await waitFor(() => {
      expect(logica(result).error).toBe(AVISO_SIN_CAJA);
    });
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('trata una respuesta de caja sin id utilizable como "no hay caja"', async () => {
    const { result, mockPost } = await montarPOS({
      get: [],
      getBy: { '/productos': PRODUCTO_STUB, '/caja/activa': {} }
    });

    await waitFor(() => {
      expect(logica(result).cajaActivaMsg).toBe(AVISO_SIN_CAJA);
    });
    expect(logica(result).cajaActivaId).toBeNull();

    await cobrarDesdeElHook(result);

    // Sin id numerico el payload se armaria con `NaN` y el backend lo
    // rechazaria igual: se trata igual que un 404.
    expect(mockPost).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════
// (b) El mensaje real del backend
// ══════════════════════════════════════════════════════════════
describe('POS - mensaje de error del cobro', () => {
  it('muestra el mensaje real del backend, no "Error desconocido"', async () => {
    const { result, mockPost } = await montarPOS(STUB_CON_CAJA);

    // El cliente de API lanza el body plano, no una `Error`.
    mockPost.mockRejectedValue({
      error: 'Stock insuficiente para productos del carrito',
      code: 'VALIDATION_ERROR'
    });

    await cobrarDesdeElHook(result);

    await waitFor(() => {
      expect(logica(result).error).toBe(
        'Error al cobrar: Stock insuficiente para productos del carrito'
      );
    });
    expect(logica(result).error).not.toContain('Error desconocido');
  });

  it('cae en "Error desconocido" solo cuando el rechazo no trae mensaje', async () => {
    const { result, mockPost } = await montarPOS(STUB_CON_CAJA);

    mockPost.mockRejectedValue({});

    await cobrarDesdeElHook(result);

    // El fallback sigue existiendo, pero ya no es lo que se ve siempre.
    await waitFor(() => {
      expect(logica(result).error).toBe('Error al cobrar: Error desconocido');
    });
  });
});

// ══════════════════════════════════════════════════════════════
// (c) Camino feliz: cobra contra la caja resuelta
// ══════════════════════════════════════════════════════════════
describe('POS - cobro contra la caja resuelta', () => {
  it('cobra contra el id que devuelve la API y sincroniza localStorage', async () => {
    const { result, mockPost } = await montarPOS(STUB_CON_CAJA);

    await waitFor(() => {
      expect(logica(result).cajaActivaId).toBe(CAJA_STUB.id);
    });
    // Con caja resuelta el aviso desaparece: no es ruido permanente.
    expect(logica(result).cajaActivaMsg).toBe('');

    await cobrarDesdeElHook(result);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledTimes(1);
    });
    expect(mockPost).toHaveBeenCalledWith(
      '/ventas',
      expect.objectContaining({ cajaId: CAJA_STUB.id })
    );
    // El bug era el fallback `|| '1'`: el id tiene que venir de la API.
    expect(mockPost).not.toHaveBeenCalledWith(
      '/ventas',
      expect.objectContaining({ cajaId: 1 })
    );

    // `CierreCaja` lee la misma clave de localStorage.
    expect(localStorage.getItem('cajaId')).toBe('7');
  });
});

// ══════════════════════════════════════════════════════════════
// (d) End-to-end: el cobro completo, atravesando el modal
// ══════════════════════════════════════════════════════════════
describe('POS - cobro end-to-end por el modal', () => {
  it('confirma el pago desde el modal y manda la venta con el cajaId resuelto', async () => {
    const { mockPost } = renderPage(<MainApp />, { stubs: STUB_CON_CAJA });

    await agregarAlCarrito();

    // Abrir el modal: con caja resuelta y carrito con items, el boton esta
    // habilitado.
    const cobrar = screen.getByRole('button', { name: /^Cobrar/ });
    await waitFor(() => {
      expect(cobrar).toBeEnabled();
    });
    fireEvent.click(cobrar);

    const modal = await modalDePago();
    const recibido = within(modal).getByRole('spinbutton');
    fireEvent.change(recibido, { target: { value: '2000' } });
    fireEvent.click(within(modal).getByRole('button', { name: /^Cobrar/ }));

    // Este es el assertion que faltaba en toda la suite. Con el wrapper roto
    // (`handleConfirmarPago` re-validando estado del hook) el modal se abria,
    // el boton se pulsaba y el POST no salia: 0 calls.
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledTimes(1);
    });
    expect(mockPost).toHaveBeenCalledWith(
      '/ventas',
      expect.objectContaining({
        cajaId: CAJA_STUB.id,
        metodoPago: 'EFECTIVO',
        montoRecibido: 2000,
        descuento: 0
      })
    );

    // Los valores salen del modal, no de un estado del hook.
    expect(mockPost.mock.calls.at(0)?.at(1)).toMatchObject({
      items: [{ productoId: 10, cantidad: 1 }]
    });
  });

  it('no manda la venta si el monto recibido no alcanza', async () => {
    const { mockPost } = renderPage(<MainApp />, { stubs: STUB_CON_CAJA });

    await agregarAlCarrito();
    fireEvent.click(screen.getByRole('button', { name: /^Cobrar/ }));

    const modal = await modalDePago();
    // El gate de monto vive en el modal: 100 contra un total de 1500.
    fireEvent.change(within(modal).getByRole('spinbutton'), { target: { value: '100' } });

    const confirmar = within(modal).getByRole('button', { name: /^Cobrar/ });
    expect(confirmar).toBeDisabled();
    fireEvent.click(confirmar);

    expect(mockPost).not.toHaveBeenCalled();
  });
});
