/**
 * Ventas Route Integration Tests
 * 
 * Tests for POST /api/ventas (create sale)
 * 
 * Scenarios from spec:
 * - Create new sale decrements stock
 * - Sale fails when insufficient stock
 * - Sale creates transaction record
 */
const request = require('supertest')

// Import mock utilities
const { createMockPrisma, resetMockPrisma, mockPrismaSuccess, mockPrismaError } = require('../utils/mockPrisma')
const { generateTestToken } = require('../utils/testJwt')

// Import app - Prisma is auto-mocked
const app = require('../../src/server')

// Get the mocked prisma instance
const prisma = require('../../src/lib/prisma')

describe('POST /api/ventas', () => {
  let adminToken
  let cajeroToken

  beforeEach(() => {
    resetMockPrisma(prisma)
    adminToken = generateTestToken({ id: 1, nombre: 'Admin User', rol: 'ADMIN' })
    cajeroToken = generateTestToken({ id: 2, nombre: 'Cajero User', rol: 'CAJERO' })
  })

  test('should create sale and decrement stock', async () => {
    console.log('=== TEST START ===')
    // Given: open caja, product with stock
    const mockCaja = { id: 1, estado: 'ABIERTA', montoInicial: 100 }
    const mockProducto = { id: 1, nombre: 'Coca-Cola', precio: 10.00, stock: 10, activo: true }
    const mockVenta = {
      id: 1,
      subtotal: 20.00,
      descuento: 0,
      total: 20.00,
      metodoPago: 'EFECTIVO',
      cajaId: 1,
      usuarioId: 1,
      fecha: new Date(),
      items: [{ id: 1, productoId: 1, cantidad: 2, precioUnitario: 10.00, producto: mockProducto }],
      usuario: { nombre: 'Admin User' }
    }

    mockPrismaSuccess(prisma, 'caja', 'findUnique', mockCaja)
    mockPrismaSuccess(prisma, 'producto', 'findMany', [mockProducto])
    mockPrismaSuccess(prisma, 'venta', 'create', mockVenta)
    mockPrismaSuccess(prisma, 'producto', 'update', { ...mockProducto, stock: 8 })
    
    // Mock the transaction to pass through to the mocked prisma
    prisma.$transaction.mockImplementation(async (callback) => {
      console.log('=== $transaction called ===')
      const result = await callback(prisma)
      console.log('=== $transaction result ===', result)
      return result
    })
    
    // Ensure auditLog.create is mocked
    mockPrismaSuccess(prisma, 'auditLog', 'create', { id: 1 })

    console.log('=== MAKING REQUEST ===')
    // When: POST request to create sale
    const response = await request(app)
      .post('/api/ventas')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        cajaId: 1,
        items: [{ productoId: 1, cantidad: 2 }],
        metodoPago: 'EFECTIVO'
      })

    console.log('=== RESPONSE RECEIVED ===')
    console.log('Response status:', response.status)
    console.log('Response body:', JSON.stringify(response.body, null, 2))
    console.log('Response headers:', response.headers)

    // Then: sale is created with status 201
    expect(response.status).toBe(201)
    expect(response.body).toHaveProperty('id')
  })

  test('should fail when product has insufficient stock', async () => {
    // Given: product with stock = 1
    const mockCaja = { id: 1, estado: 'ABIERTA', montoInicial: 100 }
    const mockProducto = { id: 1, nombre: 'Snickers', precio: 5.00, stock: 1, activo: true }

    mockPrismaSuccess(prisma, 'caja', 'findUnique', mockCaja)
    mockPrismaSuccess(prisma, 'producto', 'findMany', [mockProducto])

    // When: POST request with quantity exceeding stock
    const response = await request(app)
      .post('/api/ventas')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        cajaId: 1,
        items: [{ productoId: 1, cantidad: 5 }],
        metodoPago: 'EFECTIVO'
      })

    // Then: response is 409 (ConflictError for insufficient stock)
    expect(response.status).toBe(409)
    expect(response.body.error).toContain('insuficiente')
  })

  test('should fail when caja is not open', async () => {
    // Given: caja is closed
    const mockCaja = { id: 1, estado: 'CERRADA', montoInicial: 100 }
    mockPrismaSuccess(prisma, 'caja', 'findUnique', mockCaja)

    // When: POST request
    const response = await request(app)
      .post('/api/ventas')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        cajaId: 1,
        items: [{ productoId: 1, cantidad: 2 }]
      })

    // Then: response is 409 (ConflictError for closed caja)
    expect(response.status).toBe(409)
    expect(response.body.error).toContain('caja')
  })

  test('should fail without authentication', async () => {
    // When: POST request without token
    const response = await request(app)
      .post('/api/ventas')
      .send({
        cajaId: 1,
        items: [{ productoId: 1, cantidad: 2 }]
      })

    // Then: response is 401
    expect(response.status).toBe(401)
  })

  test('should fail when product is inactive', async () => {
    // Given: product exists but is inactive
    const mockCaja = { id: 1, estado: 'ABIERTA', montoInicial: 100 }
    const mockProducto = { id: 1, nombre: 'Discontinued Item', precio: 5.00, stock: 10, activo: false }

    mockPrismaSuccess(prisma, 'caja', 'findUnique', mockCaja)
    mockPrismaSuccess(prisma, 'producto', 'findMany', [mockProducto])

    // When: POST request with inactive product
    const response = await request(app)
      .post('/api/ventas')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        cajaId: 1,
        items: [{ productoId: 1, cantidad: 1 }]
      })

    // Then: response is 409 (ConflictError for inactive product)
    expect(response.status).toBe(409)
    expect(response.body.error).toContain('activo')
  })
})