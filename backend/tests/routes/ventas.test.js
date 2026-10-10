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

  describe('persistencia de montoRecibido, vuelto y observaciones', () => {
    const PRODUCTO = { id: 1, nombre: 'Coca-Cola', precio: 10.00, stock: 10, activo: true }
    const PRECIO_UNITARIO = 10.00
    // 2 unidades a 10.00 sin descuento
    const TOTAL = 20.00

    // Caja abierta + producto activo + venta mockeada, con la transacción en
    // passthrough, siguiendo el mismo patrón que el resto del archivo.
    const prepararVentaExitosa = () => {
      const mockCaja = { id: 1, estado: 'ABIERTA', montoInicial: 100 }
      const mockVenta = {
        id: 1,
        subtotal: TOTAL,
        descuento: 0,
        total: TOTAL,
        metodoPago: 'EFECTIVO',
        cajaId: 1,
        usuarioId: 1,
        montoRecibido: null,
        vuelto: null,
        observaciones: null,
        fecha: new Date(),
        items: [{ id: 1, productoId: 1, cantidad: 2, precioUnitario: PRECIO_UNITARIO, producto: PRODUCTO }],
        usuario: { nombre: 'Admin User' }
      }

      mockPrismaSuccess(prisma, 'caja', 'findUnique', mockCaja)
      mockPrismaSuccess(prisma, 'producto', 'findMany', [PRODUCTO])
      mockPrismaSuccess(prisma, 'venta', 'create', mockVenta)
      mockPrismaSuccess(prisma, 'producto', 'update', { ...PRODUCTO, stock: 8 })

      prisma.$transaction.mockImplementation(async (callback) => callback(prisma))
    }

    // Lee la `data` con la que el service intentó persistir la venta, que es
    // donde se observable lo que hoy se perdía.
    const dataPersistida = () => {
      const llamada = prisma.venta.create.mock.calls.at(0)
      expect(llamada).toBeDefined()
      return llamada.at(0).data
    }

    const crearVentaPorHttp = async (payload) =>
      request(app)
        .post('/api/ventas')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cajaId: 1,
          items: [{ productoId: 1, cantidad: 2 }],
          ...payload
        })

    test('should persist montoRecibido and derive vuelto on a cash sale', async () => {
      prepararVentaExitosa()

      const response = await crearVentaPorHttp({ metodoPago: 'EFECTIVO', montoRecibido: 50 })

      expect(response.status).toBe(201)

      const data = dataPersistida()
      expect(data.montoRecibido).toBe(50)
      // 50 recibido - 20 de total
      expect(data.vuelto).toBe(30)
    })

    test('should persist vuelto as null on a card sale even when montoRecibido arrives', async () => {
      prepararVentaExitosa()

      const response = await crearVentaPorHttp({ metodoPago: 'TARJETA_DEBITO', montoRecibido: 50 })

      expect(response.status).toBe(201)

      const data = dataPersistida()
      expect(data.montoRecibido).toBe(50)
      // No hay vuelto que derivar: el vuelto es un concepto del efectivo
      expect(data.vuelto).toBeNull()
    })

    test('should persist montoRecibido and vuelto as null when a cash sale omits montoRecibido', async () => {
      prepararVentaExitosa()

      const response = await crearVentaPorHttp({ metodoPago: 'EFECTIVO' })

      expect(response.status).toBe(201)

      const data = dataPersistida()
      expect(data.montoRecibido).toBeNull()
      expect(data.vuelto).toBeNull()
    })

    test('should persist observaciones sent by the route', async () => {
      prepararVentaExitosa()

      const response = await crearVentaPorHttp({
        metodoPago: 'EFECTIVO',
        observaciones: 'Cliente pidió la bebida sin hielo'
      })

      expect(response.status).toBe(201)

      const data = dataPersistida()
      expect(data.observaciones).toBe('Cliente pidió la bebida sin hielo')
    })

    test('should derive vuelto from the discounted total, not from the subtotal', async () => {
      prepararVentaExitosa()

      const response = await crearVentaPorHttp({
        metodoPago: 'EFECTIVO',
        descuento: 5,
        montoRecibido: 20
      })

      expect(response.status).toBe(201)

      const data = dataPersistida()
      // total = subtotal(20) - descuento(5) = 15, así que el vuelto es 5.
      // Usar el subtotal como base devolvería 0.
      expect(data.total).toBe(15)
      expect(data.vuelto).toBe(5)
      expect(data.observaciones).toBeNull()
    })

    test('should treat montoRecibido 0 as received instead of absent and leave total untouched', async () => {
      prepararVentaExitosa()

      const response = await crearVentaPorHttp({ metodoPago: 'EFECTIVO', montoRecibido: 0 })

      expect(response.status).toBe(201)

      const data = dataPersistida()
      // 0 es un monto recibido válido: no debe degradar a null
      expect(data.montoRecibido).toBe(0)
      expect(data.vuelto).toBe(-TOTAL)
      // Regla de producto pendiente: cobrar de menos no corrige el total
      expect(data.total).toBe(TOTAL)
    })
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