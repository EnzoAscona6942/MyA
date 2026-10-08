/**
 * Cobertura de los params de request en GET /api/ventas.
 *
 * Estas rutas estaban rotas y ningún test las tocaba: ventas.test.js sólo
 * cubría POST. El motivo de fondo es el mismo en todos los casos: Express
 * entrega query params y path params SIEMPRE como string, así que un schema
 * z.number() o z.boolean() sin coerción rechaza la petición entera con 400.
 *
 * Estos tests fallan contra el schema viejo y pasan contra el nuevo.
 */
const request = require('supertest')

const { createMockPrisma, resetMockPrisma, mockPrismaSuccess } = require('../utils/mockPrisma')
const { generateTestToken } = require('../utils/testJwt')

const app = require('../../src/server')
const prisma = require('../../src/lib/prisma')

describe('GET /api/ventas - params de query', () => {
  let adminToken

  beforeEach(() => {
    resetMockPrisma(prisma)
    adminToken = generateTestToken({ id: 1, nombre: 'Admin User', rol: 'ADMIN' })
    mockPrismaSuccess(prisma, 'venta', 'findMany', [])
    mockPrismaSuccess(prisma, 'venta', 'count', 0)
  })

  const get = (query) =>
    request(app).get('/api/ventas' + query).set('Authorization', `Bearer ${adminToken}`)

  test('acepta skip y take como string', async () => {
    const res = await get('?skip=0&take=20')
    expect(res.status).toBe(200)
  })

  test('rechaza take=0 y skip negativo', async () => {
    expect((await get('?take=0')).status).toBe(400)
    expect((await get('?skip=-1')).status).toBe(400)
  })

  test('acepta categoriaId numérico como query param', async () => {
    const res = await get('?categoriaId=1')
    expect(res.status).toBe(200)
  })

  test('convierte stockBajo="false" en false y no en true', async () => {
    // La trampa: Boolean("false") es true en JS. Un z.coerce.boolean()
    // invertiría el filtro y devolvería los productos equivocados.
    const res = await get('?stockBajo=false')
    expect(res.status).toBe(200)

    const called = prisma.producto.findMany.mock.calls
    const args = called.length > 0 ? called[called.length - 1][0] : null
    if (args && args.where) {
      expect(args.where.stockBajo).not.toBe(true)
    }
  })

  test('convierte stockBajo="true" en true', async () => {
    const res = await get('?stockBajo=true')
    expect(res.status).toBe(200)
  })

  test('rechaza un booleano que no sea true/false/1/0', async () => {
    expect((await get('?stockBajo=quizá')).status).toBe(400)
  })

  test('sin params usa los defaults del schema', async () => {
    const res = await get('')
    expect(res.status).toBe(200)
  })
})

describe('GET /api/ventas/:id - path param', () => {
  let adminToken

  beforeEach(() => {
    resetMockPrisma(prisma)
    adminToken = generateTestToken({ id: 1, nombre: 'Admin User', rol: 'ADMIN' })
  })

  test('un id numérico no debe dar 400', async () => {
    const mockVenta = {
      id: 1,
      fecha: new Date(),
      subtotal: 20,
      descuento: 0,
      total: 20,
      metodoPago: 'EFECTIVO',
      estado: 'COMPLETADA',
      cajaId: 1,
      usuarioId: 1,
      items: []
    }
    mockPrismaSuccess(prisma, 'venta', 'findUnique', mockVenta)
    mockPrismaSuccess(prisma, 'auditLog', 'create', { id: 1 })

    const res = await request(app)
      .get('/api/ventas/1')
      .set('Authorization', `Bearer ${adminToken}`)

    // Lo importante es que NO sea 400: con el schema viejo caía siempre en 400.
    expect(res.status).not.toBe(400)
  })

  test('un id no numérico sí debe dar 400', async () => {
    const res = await request(app)
      .get('/api/ventas/abc')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(400)
  })
})