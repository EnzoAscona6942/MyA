/**
 * Productos Route Integration Tests
 * 
 * Tests for CRUD operations on products
 * 
 * Scenarios from spec:
 * - Create new product
 * - Read product by ID
 * - Update product
 * - Delete product (soft delete)
 */
const request = require('supertest')

// Import mock utilities
const { createMockPrisma, resetMockPrisma, mockPrismaSuccess, mockPrismaError } = require('../utils/mockPrisma')
const { generateTestToken } = require('../utils/testJwt')

// Import app - Prisma is auto-mocked
const app = require('../../src/server')

// Get the mocked prisma instance
const prisma = require('../../src/lib/prisma')

describe('POST /api/productos', () => {
  let adminToken
  let cajeroToken

  beforeEach(() => {
    resetMockPrisma(prisma)
    adminToken = generateTestToken({ id: 1, nombre: 'Admin User', rol: 'ADMIN' })
    cajeroToken = generateTestToken({ id: 2, nombre: 'Cajero User', rol: 'CAJERO' })
  })

  test('should create product as admin', async () => {
    // Given: valid product data
    const mockProducto = {
      id: 1,
      nombre: 'Pepsi',
      precio: 15.00,
      stock: 10,
      activo: true,
      codigoBarras: '7790070000001'
    }

    mockPrismaSuccess(prisma, 'producto', 'create', mockProducto)

    // When: POST request as admin
    const response = await request(app)
      .post('/api/productos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nombre: 'Pepsi',
        codigoBarras: '7790070000001',
        precio: 15.00,
        stock: 10
      })

    // Then: product is created with status 201
    expect(response.status).toBe(201)
    expect(response.body.nombre).toBe('Pepsi')
  })

  test('should return 403 when non-admin tries to create', async () => {
    // When: POST request as cajero
    const response = await request(app)
      .post('/api/productos')
      .set('Authorization', `Bearer ${cajeroToken}`)
      .send({
        nombre: 'Test Product',
        precio: 10.00
      })

    // Then: response is 403
    expect(response.status).toBe(403)
    expect(response.body.error).toContain('administrador')
  })

  test('should fail without authentication', async () => {
    // When: POST request without token
    const response = await request(app)
      .post('/api/productos')
      .send({
        nombre: 'Test Product',
        precio: 10.00
      })

    // Then: response is 401
    expect(response.status).toBe(401)
  })
})

describe('GET /api/productos/:id', () => {
  let adminToken

  beforeEach(() => {
    resetMockPrisma(prisma)
    adminToken = generateTestToken({ id: 1, nombre: 'Admin User', rol: 'ADMIN' })
  })

  test('should return product by ID', async () => {
    // Given: product exists
    const mockProducto = {
      id: 5,
      nombre: 'Coca-Cola',
      precio: 12.00,
      stock: 20,
      activo: true,
      categoria: { id: 1, nombre: 'Bebidas' }
    }

    mockPrismaSuccess(prisma, 'producto', 'findUnique', mockProducto)

    // When: GET request
    const response = await request(app)
      .get('/api/productos/5')
      .set('Authorization', `Bearer ${adminToken}`)

    // Then: response has product data
    expect(response.status).toBe(200)
    expect(response.body.nombre).toBe('Coca-Cola')
  })

  test('should return 404 when product not found', async () => {
    // Given: product doesn't exist
    mockPrismaSuccess(prisma, 'producto', 'findUnique', null)

    // When: GET request
    const response = await request(app)
      .get('/api/productos/999')
      .set('Authorization', `Bearer ${adminToken}`)

    // Then: response is 404
    expect(response.status).toBe(404)
    expect(response.body.error).toContain('no encontrado')
  })
})

describe('PUT /api/productos/:id', () => {
  let adminToken

  beforeEach(() => {
    resetMockPrisma(prisma)
    adminToken = generateTestToken({ id: 1, nombre: 'Admin User', rol: 'ADMIN' })
  })

  test('should update product', async () => {
    // Given: product exists
    const mockProducto = {
      id: 3,
      nombre: 'Pepsi Zero',
      precio: 15.00,
      stock: 10,
      activo: true
    }

    mockPrismaSuccess(prisma, 'producto', 'update', mockProducto)

    // When: PUT request
    const response = await request(app)
      .put('/api/productos/3')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nombre: 'Pepsi Zero' })

    // Then: product is updated
    expect(response.status).toBe(200)
    expect(response.body.nombre).toBe('Pepsi Zero')
  })

  test('should return 404 when product not found', async () => {
    // Given: product doesn't exist
    const error = { code: 'P2025' }
    mockPrismaError(prisma, 'producto', 'update', error)

    // When: PUT request
    const response = await request(app)
      .put('/api/productos/999')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nombre: 'New Name' })

    // Then: response is 404
    expect(response.status).toBe(404)
  })
})

describe('DELETE /api/productos/:id', () => {
  let adminToken

  beforeEach(() => {
    resetMockPrisma(prisma)
    adminToken = generateTestToken({ id: 1, nombre: 'Admin User', rol: 'ADMIN' })
  })

  test('should soft delete product (set activo to false)', async () => {
    // Given: product exists
    mockPrismaSuccess(prisma, 'producto', 'update', { id: 3, activo: false })

    // When: DELETE request
    const response = await request(app)
      .delete('/api/productos/3')
      .set('Authorization', `Bearer ${adminToken}`)

    // Then: product is deactivated
    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty('mensaje')
  })

  test('should return 404 when product not found', async () => {
    // Given: product doesn't exist
    const error = { code: 'P2025' }
    mockPrismaError(prisma, 'producto', 'update', error)

    // When: DELETE request
    const response = await request(app)
      .delete('/api/productos/999')
      .set('Authorization', `Bearer ${adminToken}`)

    // Then: response is 404
    expect(response.status).toBe(404)
  })
})

/**
 * Barcode name lookup against Open Food Facts.
 *
 * These run the REAL service with `fetch` replaced, so the route -> service ->
 * upstream path is covered end to end. The contract that matters: an unknown
 * barcode is a 200 with `found: false`, never an error.
 */
describe('GET /api/productos/barras/:codigo/openfoodfacts', () => {
  const { productos: productosService } = require('../../src/services')

  let adminToken
  let fetchSpy

  const jsonResponse = (body, { ok = true, status = 200 } = {}) => ({
    ok,
    status,
    json: async () => body
  })

  beforeEach(() => {
    resetMockPrisma(prisma)
    productosService.resetCache()
    adminToken = generateTestToken({ id: 1, nombre: 'Admin User', rol: 'ADMIN' })
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse({ code: '3017620422003', product: { product_name: 'Nutella' } })
    )
  })

  afterEach(() => {
    fetchSpy.mockRestore()
    jest.restoreAllMocks()
    productosService.resetCache()
  })

  test('devuelve 200 con el nombre cuando Open Food Facts conoce el código', async () => {
    const response = await request(app)
      .get('/api/productos/barras/3017620422003/openfoodfacts')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      codigoBarras: '3017620422003',
      found: true,
      nombre: 'Nutella'
    })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  test('devuelve 200 con found:false cuando Open Food Facts no conoce el código', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({ code: '7791234567890', status: 0 }, { ok: false, status: 404 })
    )

    const response = await request(app)
      .get('/api/productos/barras/7791234567890/openfoodfacts')
      .set('Authorization', `Bearer ${adminToken}`)

    // Un producto ausente es un caso NORMAL, no un error.
    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      codigoBarras: '7791234567890',
      found: false,
      nombre: null
    })
  })

  test('devuelve 200 con found:false cuando el upstream se cae', async () => {
    fetchSpy.mockRejectedValue(new TypeError('fetch failed'))

    const response = await request(app)
      .get('/api/productos/barras/7791234567891/openfoodfacts')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(response.status).toBe(200)
    expect(response.body.found).toBe(false)
    expect(response.body.nombre).toBeNull()
  })

  test('rechaza un código inválido con 400 sin tocar la red', async () => {
    const response = await request(app)
      .get('/api/productos/barras/1234567/openfoodfacts')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(response.status).toBe(400)
    expect(response.body.error).toContain('parámetros')
    expect(response.body.details[0].field).toBe('codigo')
    // Un código inválido no puede gastarse una consulta del upstream.
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  test('rechaza un código con letras con 400', async () => {
    const response = await request(app)
      .get('/api/productos/barras/abcd1234efgh/openfoodfacts')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(response.status).toBe(400)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  test('exige autenticación', async () => {
    const response = await request(app).get('/api/productos/barras/3017620422003/openfoodfacts')

    expect(response.status).toBe(401)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  test('responde 503 si el servicio llegara a fallar de forma inesperada', async () => {
    // El service degrada todo a `found: false`, así que esta rama es sólo una
    // red de seguridad: cubre un fallo que impide siquiera responder.
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest
      .spyOn(productosService, 'consultarOpenFoodFacts')
      .mockRejectedValue(new Error('boom'))

    const response = await request(app)
      .get('/api/productos/barras/3017620422003/openfoodfacts')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(response.status).toBe(503)
    expect(response.body.error).toContain('Open Food Facts')
  })
})