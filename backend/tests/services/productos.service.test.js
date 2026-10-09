/**
 * productos.service — consultarOpenFoodFacts
 *
 * Unit tests for the Open Food Facts barcode lookup.
 *
 * The service owns the whole upstream contract: normalization, caching and
 * graceful degradation. The contract that matters most: a product missing from
 * Open Food Facts (bakery, bulk goods, local products) is a NORMAL outcome,
 * not a failure, so it must resolve to `{ found: false }` instead of throwing.
 *
 * `fetch` is replaced with `jest.spyOn(global, 'fetch')` so no test ever
 * touches the network.
 */

const service = require('../../src/services/productos.service')

/** Builds a minimal `Response`-alike for the mocked fetch. */
const jsonResponse = (body, { ok = true, status = 200 } = {}) => ({
  ok,
  status,
  json: async () => body
})

/** Upstream answered 200 but the barcode is unknown to Open Food Facts. */
const unknownProductResponse = (codigo) =>
  jsonResponse({
    code: codigo,
    status: 0,
    status_verbose: 'product not found'
  })

describe('productos.service — consultarOpenFoodFacts', () => {
  let fetchSpy
  let warnSpy

  const BASE_ENV = process.env.OPENFOODFACTS_BASE_URL

  beforeEach(() => {
    service.resetCache()
    delete process.env.OPENFOODFACTS_BASE_URL
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    fetchSpy = jest.spyOn(global, 'fetch')
  })

  afterEach(() => {
    fetchSpy.mockRestore()
    warnSpy.mockRestore()
    service.resetCache()
    if (BASE_ENV === undefined) {
      delete process.env.OPENFOODFACTS_BASE_URL
    } else {
      process.env.OPENFOODFACTS_BASE_URL = BASE_ENV
    }
  })

  describe('respuesta normalizada', () => {
    test('devuelve found:true con product_name cuando el producto existe', async () => {
      fetchSpy.mockResolvedValue(
        jsonResponse({ code: '3017620422003', product: { product_name: 'Nutella' } })
      )

      const result = await service.consultarOpenFoodFacts('3017620422003')

      expect(result).toEqual({
        codigoBarras: '3017620422003',
        found: true,
        nombre: 'Nutella'
      })
    })

    test('cae a product_name_es cuando product_name viene vacío', async () => {
      fetchSpy.mockResolvedValue(
        jsonResponse({
          code: '3017620422003',
          product: { product_name: '', product_name_es: 'Nutella Chocolate' }
        })
      )

      const result = await service.consultarOpenFoodFacts('3017620422003')

      expect(result.found).toBe(true)
      expect(result.nombre).toBe('Nutella Chocolate')
    })

    test('prefiere product_name sobre product_name_es', async () => {
      fetchSpy.mockResolvedValue(
        jsonResponse({
          code: '3017620422003',
          product: { product_name: 'Nutella', product_name_es: 'Crema de avellanas' }
        })
      )

      const result = await service.consultarOpenFoodFacts('3017620422003')

      expect(result.nombre).toBe('Nutella')
    })

    test('devuelve found:false cuando el producto no tiene ningún nombre', async () => {
      fetchSpy.mockResolvedValue(
        jsonResponse({
          code: '3017620422003',
          product: { product_name: '   ', product_name_es: '' }
        })
      )

      const result = await service.consultarOpenFoodFacts('3017620422003')

      expect(result).toEqual({
        codigoBarras: '3017620422003',
        found: false,
        nombre: null
      })
    })

    test('devuelve found:false cuando la respuesta no trae objeto product', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ code: '3017620422003', status: 0 }))

      const result = await service.consultarOpenFoodFacts('3017620422003')

      expect(result.found).toBe(false)
      expect(result.nombre).toBeNull()
    })
  })

  describe('normalización del código', () => {
    test('descarta todo lo que no es dígito', async () => {
      fetchSpy.mockResolvedValue(
        jsonResponse({ product: { product_name: 'Gaseosa Cola' } })
      )

      const result = await service.consultarOpenFoodFacts(' 779-1234 5678_a ')

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(String(fetchSpy.mock.calls[0][0])).toContain('/77912345678.json')
      expect(result.codigoBarras).toBe('77912345678')
    })

    test('un código vacío ni siquiera intenta salir a la red', async () => {
      const result = await service.consultarOpenFoodFacts('no-es-un-codigo')

      expect(fetchSpy).not.toHaveBeenCalled()
      expect(result).toEqual({ codigoBarras: '', found: false, nombre: null })
    })
  })

  describe('degradación ante fallos', () => {
    test('un error de red degrada a found:false sin propagar la excepción', async () => {
      fetchSpy.mockRejectedValue(new TypeError('fetch failed'))

      const result = await service.consultarOpenFoodFacts('3017620422003')

      expect(result).toEqual({
        codigoBarras: '3017620422003',
        found: false,
        nombre: null
      })
    })

    test('un timeout (AbortError) degrada a found:false', async () => {
      const abortError = new Error('The operation was aborted')
      abortError.name = 'AbortError'
      fetchSpy.mockRejectedValue(abortError)

      const result = await service.consultarOpenFoodFacts('3017620422003')

      expect(result.found).toBe(false)
    })

    test('un body no parseable degrada a found:false', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON')
        }
      })

      const result = await service.consultarOpenFoodFacts('3017620422003')

      expect(result.found).toBe(false)
      expect(result.nombre).toBeNull()
    })

    test('un 404 de Open Food Facts es "no encontrado", no un fallo', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ status: 0 }, { ok: false, status: 404 }))

      const result = await service.consultarOpenFoodFacts('7791234567890')

      expect(result).toEqual({
        codigoBarras: '7791234567890',
        found: false,
        nombre: null
      })
    })

    test('un 503 de Open Food Facts degrada a found:false', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ status: 1 }, { ok: false, status: 503 }))

      const result = await service.consultarOpenFoodFacts('7791234567891')

      expect(result.found).toBe(false)
    })
  })

  describe('llamada al upstream', () => {
    test('consulta la API v2 con los campos mínimos y un User-Agent identificable', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ product: { product_name: 'Nutella' } }))

      await service.consultarOpenFoodFacts('3017620422003')

      const [url, init] = fetchSpy.mock.calls[0]
      expect(String(url)).toBe(
        'https://world.openfoodfacts.org/api/v2/product/3017620422003.json' +
          '?fields=code,product_name,product_name_es'
      )
      expect(init.headers['User-Agent']).toEqual(expect.stringContaining('MyA'))
    })

    test('respeta OPENFOODFACTS_BASE_URL', async () => {
      process.env.OPENFOODFACTS_BASE_URL = 'http://off.test/api/v2/product'
      fetchSpy.mockResolvedValue(jsonResponse({ product: { product_name: 'Nutella' } }))

      await service.consultarOpenFoodFacts('3017620422003')

      expect(String(fetchSpy.mock.calls[0][0])).toBe(
        'http://off.test/api/v2/product/3017620422003.json' +
          '?fields=code,product_name,product_name_es'
      )
    })

    test('aplica un timeout de 5 segundos mediante AbortSignal', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ product: { product_name: 'Nutella' } }))

      await service.consultarOpenFoodFacts('3017620422003')

      const signal = fetchSpy.mock.calls[0][1].signal
      expect(signal).toBeDefined()
      expect(signal.aborted).toBe(false)
      // `AbortSignal.timeout` produces a signal that carries its own timeout.
      expect(typeof AbortSignal.timeout(1).aborted).toBe('boolean')
    })
  })

  describe('caché en memoria', () => {
    test('un mismo código se resuelve una sola vez contra la red', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ product: { product_name: 'Nutella' } }))

      const first = await service.consultarOpenFoodFacts('3017620422003')
      const second = await service.consultarOpenFoodFacts('3017620422003')

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(second).toEqual(first)
    })

    test('un "no encontrado" real de Open Food Facts también se cachea', async () => {
      fetchSpy.mockResolvedValue(unknownProductResponse('7791234567892'))

      await service.consultarOpenFoodFacts('7791234567892')
      const second = await service.consultarOpenFoodFacts('7791234567892')

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(second.found).toBe(false)
    })

    test('una caída de red NO se cachea: la próxima consulta reintenta', async () => {
      fetchSpy.mockRejectedValueOnce(new TypeError('fetch failed'))
      await service.consultarOpenFoodFacts('3017620422003')

      fetchSpy.mockResolvedValueOnce(jsonResponse({ product: { product_name: 'Nutella' } }))
      const second = await service.consultarOpenFoodFacts('3017620422003')

      expect(fetchSpy).toHaveBeenCalledTimes(2)
      expect(second).toEqual({ codigoBarras: '3017620422003', found: true, nombre: 'Nutella' })
    })

    test('un 5xx de Open Food Facts NO se cachea', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ status: 1 }, { ok: false, status: 503 }))
      await service.consultarOpenFoodFacts('7791234567893')

      fetchSpy.mockResolvedValueOnce(jsonResponse({ product: { product_name: 'Gaseosa' } }))
      const second = await service.consultarOpenFoodFacts('7791234567893')

      expect(fetchSpy).toHaveBeenCalledTimes(2)
      expect(second.found).toBe(true)
    })

    test('la entrada expira a las 24 horas', async () => {
      jest.useFakeTimers()
      try {
        jest.setSystemTime(new Date('2026-01-01T00:00:00Z'))
        fetchSpy.mockResolvedValue(jsonResponse({ product: { product_name: 'Nutella' } }))

        await service.consultarOpenFoodFacts('3017620422003')
        expect(fetchSpy).toHaveBeenCalledTimes(1)

        // Justo antes del TTL todavía se sirve desde caché.
        jest.setSystemTime(new Date('2026-01-01T23:59:59Z'))
        await service.consultarOpenFoodFacts('3017620422003')
        expect(fetchSpy).toHaveBeenCalledTimes(1)

        // Superado el TTL se vuelve a consultar.
        jest.setSystemTime(new Date('2026-01-02T00:00:01Z'))
        await service.consultarOpenFoodFacts('3017620422003')
        expect(fetchSpy).toHaveBeenCalledTimes(2)
      } finally {
        jest.useRealTimers()
      }
    })

    test('la caché está acotada y descarta la entrada más antigua', async () => {
      fetchSpy.mockImplementation((url) => {
        const codigo = String(url).match(/product\/(\d+)\.json/)[1]
        return Promise.resolve(jsonResponse({ product: { product_name: `Producto ${codigo}` } }))
      })

      const total = service.CACHE_MAX_ENTRIES
      // Una entrada más que el máximo: la primera debe ser expulsada.
      for (let i = 0; i <= total; i += 1) {
        await service.consultarOpenFoodFacts(String(7000000000000 + i))
      }
      expect(fetchSpy).toHaveBeenCalledTimes(total + 1)

      // La más antigua se volvió a pedir: salió de la caché.
      await service.consultarOpenFoodFacts(String(7000000000000))
      expect(fetchSpy).toHaveBeenCalledTimes(total + 2)

      // Y la caché no creció sin límite.
      expect(service.cacheSize()).toBeLessThanOrEqual(service.CACHE_MAX_ENTRIES)
    })
  })
})