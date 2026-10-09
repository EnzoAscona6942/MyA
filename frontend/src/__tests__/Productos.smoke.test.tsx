/**
 * Smoke test del módulo Productos.
 *
 * Monta la página real con la API mockeada y verifica que renderiza. La página
 * consume `useChunkedUpload`, que lee `API_URL` y `getHeaders` de `../lib/api`:
 * el harness mockea ambos, así que el hook debe montar en estado `idle` y el
 * botón de carga masiva tiene que quedar habilitado.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { fireEvent, act } from '@testing-library/react';
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

/**
 * Lookup del nombre por código de barras contra Open Food Facts.
 *
 * El trigger real de un lector USB es el Enter que el lector manda al terminar
 * de escanear, así que el caso central es ese, no el debounce. Los tests
 * manejan los timers a mano (`vi.useFakeTimers`) para poder afirmar "consultó
 * SIN dejar correr el reloj", que es lo que distingue al Enter del debounce.
 */
describe('Productos - autocompletado de nombre por código de barras', () => {
  const DEBOUNCE_MS = 400;
  const CODIGO = '3017620422003';
  const CODIGO_VIEJO = '7790000000001';
  const CODIGO_NUEVO = '7790000000002';

  const ENCONTRADO = { codigoBarras: CODIGO, found: true, nombre: 'Nutella' };

  /**
   * Abre el modal ABM y devuelve los inputs por atributo `name`. Se usa
   * querySelector y no getByLabelText porque los labels de la página no tienen
   * `htmlFor`; agregar ids al formulario excede el alcance de esta feature.
   */
  const abrirModal = () => {
    fireEvent.click(screen.getByRole('button', { name: '+ Nuevo Producto' }));

    const barcode = document.querySelector<HTMLInputElement>('input[name="codigoBarras"]');
    const nombre = document.querySelector<HTMLInputElement>('input[name="nombre"]');
    if (!barcode || !nombre) throw new Error('El modal ABM no se montó');
    return { barcode, nombre };
  };

  /** Monta la página y deja la API resuelta por prefijo de URL. */
  const montar = (getBy: Record<string, unknown> = {}) =>
    renderPage(<Productos />, {
      stubs: {
        getBy: {
          // Más específico primero: el matcher del harness usa `startsWith`.
          '/productos/barras': ENCONTRADO,
          '/productos': PRODUCTOS_STUB,
          '/categorias': [{ id: 1, nombre: 'Almacen', descripcion: null, creadoEn: '' }],
          ...getBy,
        },
      },
    });

  /** Deja que las promesas pendientes resuelvan dentro de `act`. */
  const flush = async () => {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  };

  /**
   * AuthProvider sólo renderiza sus hijos cuando termina de verificar la caja
   * activa, así que hay que dejar correr las microtareas del montaje antes de
   * buscar el botón del modal.
   */
  const montarYAbrir = async (getBy: Record<string, unknown> = {}) => {
    const rendered = montar(getBy);
    await flush();
    return { ...rendered, ...abrirModal() };
  };

  const llamadasLookup = (mockGet: unknown): string[] =>
    (mockGet as { mock: { calls: unknown[][] } }).mock.calls
      .map((c) => String(c[0]))
      .filter((url) => url.includes('/openfoodfacts'));

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('completa el nombre al presionar Enter, sin esperar el debounce', async () => {
    const { barcode, nombre, mockGet } = await montarYAbrir();

    fireEvent.change(barcode, { target: { value: CODIGO } });
    fireEvent.keyDown(barcode, { key: 'Enter' });
    await flush();

    // No se avanzó ningún timer: la consulta salió por el Enter.
    expect(llamadasLookup(mockGet)).toEqual([`/productos/barras/${CODIGO}/openfoodfacts`]);
    expect(nombre.value).toBe('Nutella');
    expect(screen.getByText('Encontrado: Nutella')).toBeInTheDocument();
  });

  it('espera 400ms de debounce al tipear y reinicia el timer en cada tecla', async () => {
    const { barcode, mockGet } = await montarYAbrir();

    fireEvent.change(barcode, { target: { value: '30176204220' } });
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS - 100);
    });
    expect(llamadasLookup(mockGet)).toHaveLength(0);

    // Una tecla más reinicia el reloj: ya pasaron 300ms de los 400.
    fireEvent.change(barcode, { target: { value: CODIGO } });
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS - 100);
    });
    expect(llamadasLookup(mockGet)).toHaveLength(0);

    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    await flush();
    expect(llamadasLookup(mockGet)).toHaveLength(1);
  });

  it('no consulta si el operador ya escribió el nombre', async () => {
    const { barcode, nombre, mockGet } = await montarYAbrir();

    fireEvent.change(nombre, { target: { value: 'Nutella casera' } });
    fireEvent.change(barcode, { target: { value: CODIGO } });
    fireEvent.keyDown(barcode, { key: 'Enter' });
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS);
    });
    await flush();

    expect(llamadasLookup(mockGet)).toHaveLength(0);
    // El nombre escrito a mano no se pisa.
    expect(nombre.value).toBe('Nutella casera');
  });

  it('no consulta con un código que no tiene entre 8 y 14 dígitos', async () => {
    const { barcode, mockGet } = await montarYAbrir();

    fireEvent.change(barcode, { target: { value: '1234567' } });
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS);
    });
    fireEvent.keyDown(barcode, { key: 'Enter' });
    await flush();

    expect(llamadasLookup(mockGet)).toHaveLength(0);
  });

  it('avisa que no está en Open Food Facts y deja escribir el nombre a mano', async () => {
    const { barcode, nombre, mockGet } = await montarYAbrir({
      '/productos/barras': { codigoBarras: CODIGO, found: false, nombre: null },
    });

    fireEvent.change(barcode, { target: { value: CODIGO } });
    fireEvent.keyDown(barcode, { key: 'Enter' });
    await flush();

    expect(llamadasLookup(mockGet)).toHaveLength(1);
    expect(
      screen.getByText('No figura en Open Food Facts. Cargá el nombre a mano.')
    ).toBeInTheDocument();

    // No bloquea el formulario: el operador sigue escribiendo.
    fireEvent.change(nombre, { target: { value: 'Pan casero' } });
    expect(nombre.value).toBe('Pan casero');
  });

  it('muestra el error de consulta sin bloquear el formulario', async () => {
    const { mockGet } = montar();
    await flush();
    (mockGet as ReturnType<typeof vi.fn>).mockImplementation((url: string) =>
      url.includes('/openfoodfacts')
        ? Promise.reject({ error: 'Error de red' })
        : Promise.resolve(PRODUCTOS_STUB)
    );
    const { barcode, nombre } = abrirModal();

    fireEvent.change(barcode, { target: { value: CODIGO } });
    fireEvent.keyDown(barcode, { key: 'Enter' });
    await flush();

    expect(
      screen.getByText('No se pudo consultar Open Food Facts. Cargá el nombre a mano.')
    ).toBeInTheDocument();

    fireEvent.change(nombre, { target: { value: 'Manual' } });
    expect(nombre.value).toBe('Manual');
  });

  it('una respuesta vieja no pisa el resultado de un código más nuevo', async () => {
    const { mockGet } = montar();
    await flush();

    let resolverViejo: (valor: unknown) => void = () => {};
    const respuestaVieja = new Promise((resolve) => {
      resolverViejo = resolve;
    });

    (mockGet as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes(CODIGO_VIEJO)) return respuestaVieja;
      if (url.includes('/openfoodfacts')) return Promise.resolve(ENCONTRADO);
      return Promise.resolve(PRODUCTOS_STUB);
    });

    const { barcode, nombre } = abrirModal();

    // Se escanea un código y la respuesta llega tarde.
    fireEvent.change(barcode, { target: { value: CODIGO_VIEJO } });
    fireEvent.keyDown(barcode, { key: 'Enter' });
    await flush();

    // El operador escanea otro código: el nuevo gana.
    fireEvent.change(barcode, { target: { value: CODIGO_NUEVO } });
    fireEvent.keyDown(barcode, { key: 'Enter' });
    await flush();
    expect(nombre.value).toBe('Nutella');

    // Llega la respuesta vieja: no debe pisar el nombre nuevo.
    await act(async () => {
      resolverViejo({ codigoBarras: CODIGO_VIEJO, found: true, nombre: 'Nombre viejo' });
      await respuestaVieja;
    });
    expect(nombre.value).toBe('Nutella');
  });

  it('cancela la petición en vuelo cuando cambia el código', async () => {
    const { mockGet } = montar();
    await flush();
    const { barcode } = abrirModal();

    fireEvent.change(barcode, { target: { value: CODIGO } });
    fireEvent.keyDown(barcode, { key: 'Enter' });
    await flush();

    const señalEnVuelo = (mockGet as ReturnType<typeof vi.fn>).mock.calls
      .map((c) => (c[1] as { signal?: AbortSignal } | undefined)?.signal)
      .filter((s): s is AbortSignal => Boolean(s));
    expect(señalEnVuelo).toHaveLength(1);
    expect(señalEnVuelo[0]?.aborted).toBe(false);

    fireEvent.change(barcode, { target: { value: CODIGO_NUEVO } });
    fireEvent.keyDown(barcode, { key: 'Enter' });
    await flush();

    expect(señalEnVuelo[0]?.aborted).toBe(true);
  });

  it('cerrar el modal cancela la consulta en vuelo', async () => {
    const { mockGet } = montar();
    await flush();
    const { barcode } = abrirModal();

    // Respuesta diferida para poder observar la petición mientras sigue viva.
    let resolver: (valor: unknown) => void = () => {};
    const pendiente = new Promise((resolve) => {
      resolver = resolve;
    });
    (mockGet as ReturnType<typeof vi.fn>).mockImplementation((url: string) =>
      url.includes('/openfoodfacts') ? pendiente : Promise.resolve(PRODUCTOS_STUB)
    );

    fireEvent.change(barcode, { target: { value: CODIGO } });
    fireEvent.keyDown(barcode, { key: 'Enter' });
    await flush();

    const señal = (mockGet as ReturnType<typeof vi.fn>).mock.calls
      .map((c) => (c[1] as { signal?: AbortSignal } | undefined)?.signal)
      .filter((s): s is AbortSignal => Boolean(s))[0];
    expect(señal?.aborted).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await flush();

    // Cerrar el modal aborta la consulta: su respuesta ya no interesa.
    expect(señal?.aborted).toBe(true);

    await act(async () => {
      resolver(ENCONTRADO);
      await pendiente;
    });
  });

  it('muestra el input de código como numérico y conserva el placeholder', async () => {
    const { barcode } = await montarYAbrir();

    expect(barcode.getAttribute('inputmode')).toBe('numeric');
    expect(barcode.placeholder).toBe('Escaneá acá...');
  });
});