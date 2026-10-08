/**
 * Caja Route Integration Tests
 * 
 * Tests for caja operations (income, expense, state transitions)
 * 
 * Scenarios from spec:
 * - Add income to caja
 * - Add expense to caja
 * - Caja balance cannot go negative
 */
const request = require('supertest')

// Import mock utilities
const { createMockPrisma, resetMockPrisma, mockPrismaSuccess, mockPrismaError } = require('../utils/mockPrisma')
const { generateTestToken } = require('../utils/testJwt')

// Import app - Prisma is auto-mocked
const app = require('../../src/server')

// Get the mocked prisma instance
const prisma = require('../../src/lib/prisma')

describe('POST /api/caja/:id/movimiento', () => {
  let adminToken

  beforeEach(() => {
    resetMockPrisma(prisma)
    adminToken = generateTestToken({ id: 1, nombre: 'Admin User', rol: 'ADMIN' })
  })

  test('should add income to caja', async () => {
    // Given: open caja with balance 100
    const mockCaja = { id: 1, estado: 'ABIERTA', montoInicial: 100 }
    const mockMovimiento = { id: 1, tipo: 'INGRESO', monto: 50, descripcion: 'Venta adicional', cajaId: 1 }

    mockPrismaSuccess(prisma, 'caja', 'findUnique', mockCaja)
    mockPrismaSuccess(prisma, 'movimientoCaja', 'create', mockMovimiento)

    // When: POST income request
    const response = await request(app)
      .post('/api/caja/1/movimiento')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        tipo: 'INGRESO',
        monto: 50,
        descripcion: 'Venta adicional'
      })

    // Then: response is 201 with movement
    expect(response.status).toBe(201)
    expect(response.body.tipo).toBe('INGRESO')
    expect(response.body.monto).toBe(50)
  })

  test('should subtract expense from caja', async () => {
    // Given: open caja with balance 100
    const mockCaja = { id: 1, estado: 'ABIERTA', montoInicial: 100 }
    const mockMovimiento = { id: 1, tipo: 'EGRESO', monto: 30, descripcion: 'Gasto', cajaId: 1 }

    mockPrismaSuccess(prisma, 'caja', 'findUnique', mockCaja)
    mockPrismaSuccess(prisma, 'movimientoCaja', 'create', mockMovimiento)

    // When: POST expense request
    const response = await request(app)
      .post('/api/caja/1/movimiento')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        tipo: 'EGRESO',
        monto: 30,
        descripcion: 'Gasto'
      })

    // Then: response is 201 with movement
    expect(response.status).toBe(201)
    expect(response.body.tipo).toBe('EGRESO')
    expect(response.body.monto).toBe(30)
  })

  test('should fail when caja is not open for movements', async () => {
    // Given: closed caja
    const mockCaja = { id: 1, estado: 'CERRADA', montoInicial: 100 }
    mockPrismaSuccess(prisma, 'caja', 'findUnique', mockCaja)

    // When: POST movement request
    const response = await request(app)
      .post('/api/caja/1/movimiento')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        tipo: 'INGRESO',
        monto: 50,
        descripcion: 'Test income'
      })

    // Then: response is 400
    expect(response.status).toBe(400)
    expect(response.body.error).toContain('abierta')
  })

  test('should fail with invalid movement type', async () => {
    // Given: open caja
    const mockCaja = { id: 1, estado: 'ABIERTA', montoInicial: 100 }
    mockPrismaSuccess(prisma, 'caja', 'findUnique', mockCaja)

    // When: POST with invalid type
    const response = await request(app)
      .post('/api/caja/1/movimiento')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        tipo: 'INVALIDO',
        monto: 50,
        descripcion: 'Test'
      })

    // Then: response is 400
    expect(response.status).toBe(400)
    expect(response.body.error).toContain('INGRESO')
  })

  test('should fail without authentication', async () => {
    // When: POST without token
    const response = await request(app)
      .post('/api/caja/1/movimiento')
      .send({
        tipo: 'INGRESO',
        monto: 50,
        descripcion: 'Test'
      })

    // Then: response is 401
    expect(response.status).toBe(401)
  })
})

describe('GET /api/caja/activa', () => {
  beforeEach(() => {
    resetMockPrisma(prisma)
  })

  test('should return open caja with sales summary', async () => {
    // Given: open caja with sales
    const mockCaja = {
      id: 1,
      estado: 'ABIERTA',
      montoInicial: 100,
      usuario: { nombre: 'Admin' },
      movimientos: []
    }
    const mockResumen = { _sum: { total: 500 }, _count: { id: 10 } }

    mockPrismaSuccess(prisma, 'caja', 'findFirst', mockCaja)
    mockPrismaSuccess(prisma, 'venta', 'aggregate', mockResumen)

    // When: GET active caja
    const adminToken = generateTestToken({ id: 1, nombre: 'Admin', rol: 'ADMIN' })
    const response = await request(app)
      .get('/api/caja/activa')
      .set('Authorization', `Bearer ${adminToken}`)

    // Then: response has caja data with sales summary
    expect(response.status).toBe(200)
    expect(response.body.estado).toBe('ABIERTA')
    expect(response.body.totalVentas).toBe(500)
  })

  test('should return 404 when no caja is open', async () => {
    // Given: no open caja
    mockPrismaSuccess(prisma, 'caja', 'findFirst', null)

    // When: GET active caja
    const adminToken = generateTestToken({ id: 1, nombre: 'Admin', rol: 'ADMIN' })
    const response = await request(app)
      .get('/api/caja/activa')
      .set('Authorization', `Bearer ${adminToken}`)

    // Then: response is 404
    expect(response.status).toBe(404)
    expect(response.body.error).toContain('abierta')
  })
})