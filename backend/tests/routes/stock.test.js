/**
 * Stock Route Integration Tests
 *
 * Tests for POST /api/stock/ingreso — price propagation to Producto.precio
 *
 * Scenarios from spec:
 * 1. Price > 0 → updates Producto.precio
 * 2. Price null → keeps existing precio
 * 3. Price = 0 → no propagation (stored in IngresoStockItem as 0 but Producto.precio unchanged)
 * 4. Empty form field → frontend sends null (not 0)
 * 5. Filled form field → frontend sends the value
 */
const request = require('supertest')

const { createMockPrisma, resetMockPrisma, mockPrismaSuccess, mockPrismaError } = require('../utils/mockPrisma')
const { generateTestToken } = require('../utils/testJwt')

const app = require('../../src/server')
const prisma = require('../../src/lib/prisma')

// Helper: default ingreso payload
function ingresoPayload(items) {
  return {
    proveedorId: '1',
    numeroRemito: '0001-00012345',
    items
  }
}

describe('POST /api/stock/ingreso — price propagation', () => {
  let adminToken

  beforeEach(() => {
    resetMockPrisma(prisma)
    adminToken = generateTestToken({ id: 1, nombre: 'Admin User', rol: 'ADMIN' })
  })

  // Scenario 1: Price > 0 → updates Producto.precio
  test('should update Producto.precio when precioUnitario > 0', async () => {
    // Given: producto exists, $transaction callback will receive mocked tx
    const mockIngreso = { id: 1, total: 200 }
    const mockProducto = { id: 5, nombre: 'Aceite', stock: 10, precio: 100 }

    mockPrismaSuccess(prisma, 'ingresoStock', 'create', mockIngreso)
    mockPrismaSuccess(prisma, 'producto', 'update', mockProducto)

    // When: POST with precioUnitario = 100 (> 0)
    const response = await request(app)
      .post('/api/stock/ingreso')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(ingresoPayload([
        { productoId: '5', cantidad: '2', precioUnitario: '100' }
      ]))

    // Then: status 201 and producto.update was called with precio
    expect(response.status).toBe(201)

    // Verify producto.update was called with the conditional precio
    const updateCall = prisma.producto.update.mock.calls[0]
    expect(updateCall).toBeDefined()
    expect(updateCall[0].where.id).toBe(5)
    expect(updateCall[0].data.stock.increment).toBe(2)
    // precio should be included because 100 > 0
    expect(updateCall[0].data.precio).toBe(100)
  })

  // Scenario 2: Price null → keeps existing precio
  test('should NOT include precio in update when precioUnitario is null', async () => {
    const mockIngreso = { id: 2, total: null }
    const mockProducto = { id: 10, nombre: 'Harina', stock: 20, precio: 50 }

    mockPrismaSuccess(prisma, 'ingresoStock', 'create', mockIngreso)
    mockPrismaSuccess(prisma, 'producto', 'update', mockProducto)

    // When: POST with null precioUnitario
    const response = await request(app)
      .post('/api/stock/ingreso')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(ingresoPayload([
        { productoId: '10', cantidad: '5', precioUnitario: null }
      ]))

    // Then: status 201 and producto.update was called WITHOUT precio
    expect(response.status).toBe(201)

    const updateCall = prisma.producto.update.mock.calls[0]
    expect(updateCall).toBeDefined()
    expect(updateCall[0].data.stock.increment).toBe(5)
    // precio should NOT be present in the data
    expect(updateCall[0].data.precio).toBeUndefined()
  })

  // Scenario 3: Price = 0 → no propagation
  // (stored in IngresoStockItem as 0 but Producto.precio unchanged)
  test('should NOT include precio when precioUnitario is 0', async () => {
    const mockIngreso = { id: 3, total: 0 }
    const mockProducto = { id: 15, nombre: 'Sal', stock: 30, precio: 25 }

    mockPrismaSuccess(prisma, 'ingresoStock', 'create', mockIngreso)
    mockPrismaSuccess(prisma, 'producto', 'update', mockProducto)

    // When: POST with precioUnitario = 0
    const response = await request(app)
      .post('/api/stock/ingreso')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(ingresoPayload([
        { productoId: '15', cantidad: '10', precioUnitario: '0' }
      ]))

    // Then: status 201 and producto.update WITHOUT precio
    expect(response.status).toBe(201)

    const updateCall = prisma.producto.update.mock.calls[0]
    expect(updateCall).toBeDefined()
    expect(updateCall[0].data.stock.increment).toBe(10)
    // precio should NOT be present (0 is NOT > 0)
    expect(updateCall[0].data.precio).toBeUndefined()
  })

  // Scenario 4: Frontend sends null for empty price field → keeps existing precio
  test('should handle null precioUnitario (frontend sends null for empty field)', async () => {
    const mockIngreso = { id: 4, total: null }
    const mockProducto = { id: 20, nombre: 'Azúcar', stock: 15, precio: 30 }

    mockPrismaSuccess(prisma, 'ingresoStock', 'create', mockIngreso)
    mockPrismaSuccess(prisma, 'producto', 'update', mockProducto)

    // When: POST with precioUnitario = null (empty form field)
    const response = await request(app)
      .post('/api/stock/ingreso')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(ingresoPayload([
        { productoId: '20', cantidad: '3', precioUnitario: null }
      ]))

    // Then: status 201, no precio in producto.update
    expect(response.status).toBe(201)

    const updateCall = prisma.producto.update.mock.calls[0]
    expect(updateCall).toBeDefined()
    expect(updateCall[0].data.stock.increment).toBe(3)
    expect(updateCall[0].data.precio).toBeUndefined()
  })

  // Scenario 5: Filled form field → frontend sends the value (should update precio)
  test('should update precio when frontend sends a valid price value', async () => {
    const mockIngreso = { id: 5, total: 450 }
    const mockProducto = { id: 25, nombre: 'Yerba', stock: 8, precio: 150 }

    mockPrismaSuccess(prisma, 'ingresoStock', 'create', mockIngreso)
    mockPrismaSuccess(prisma, 'producto', 'update', mockProducto)

    // When: POST with precioUnitario = 450
    const response = await request(app)
      .post('/api/stock/ingreso')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(ingresoPayload([
        { productoId: '25', cantidad: '3', precioUnitario: '450' }
      ]))

    // Then: status 201, precio IS in update data
    expect(response.status).toBe(201)

    const updateCall = prisma.producto.update.mock.calls[0]
    expect(updateCall).toBeDefined()
    expect(updateCall[0].data.stock.increment).toBe(3)
    expect(updateCall[0].data.precio).toBe(450)
  })

  // Auth guard test (non-admin → 403)
  test('should return 403 when non-admin tries to register ingreso', async () => {
    const cajeroToken = generateTestToken({ id: 2, nombre: 'Cajero', rol: 'CAJERO' })

    const response = await request(app)
      .post('/api/stock/ingreso')
      .set('Authorization', `Bearer ${cajeroToken}`)
      .send(ingresoPayload([
        { productoId: '1', cantidad: '1', precioUnitario: '100' }
      ]))

    expect(response.status).toBe(403)
  })

  // Empty items → 400
  test('should return 400 when items array is empty', async () => {
    const response = await request(app)
      .post('/api/stock/ingreso')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(ingresoPayload([]))

    expect(response.status).toBe(400)
    expect(response.body.error).toContain('al menos un item')
  })
})
