// Manual Prisma mock for Jest
// This file is auto-mocked by Jest when requiring '@prisma/client'

const mockAuditLogCreate = jest.fn().mockResolvedValue({ id: 1 })
mockAuditLogCreate.catch = jest.fn()

const mockFn = (returnValue = null) => {
  const fn = jest.fn().mockResolvedValue(returnValue)
  fn.catch = jest.fn()
  return fn
}

module.exports = {
  usuario: {
    findUnique: mockFn(),
    findFirst: mockFn(),
    create: mockFn(),
    update: mockFn(),
    delete: mockFn(),
    findMany: mockFn([]),
    count: mockFn(0)
  },
  producto: {
    findUnique: mockFn(),
    findFirst: mockFn(),
    create: mockFn(),
    update: mockFn(),
    delete: mockFn(),
    findMany: mockFn([]),
    count: mockFn(0)
  },
  venta: {
    findUnique: mockFn(),
    findFirst: mockFn(),
    create: mockFn(),
    update: mockFn(),
    findMany: mockFn([]),
    count: mockFn(0),
    aggregate: mockFn({ _sum: { total: 0 }, _count: { id: 0 } }),
    groupBy: mockFn([])
  },
  caja: {
    findUnique: mockFn(),
    findFirst: mockFn(),
    create: mockFn(),
    update: mockFn(),
    findMany: mockFn([]),
    count: mockFn(0)
  },
  movimientoCaja: {
    findUnique: mockFn(),
    findFirst: mockFn(),
    create: mockFn(),
    findMany: mockFn([]),
    count: mockFn(0)
  },
  categoria: {
    findUnique: mockFn(),
    findFirst: mockFn(),
    create: mockFn(),
    update: mockFn(),
    delete: mockFn(),
    findMany: mockFn([]),
    count: mockFn(0)
  },
  proveedor: {
    findUnique: mockFn(),
    findFirst: mockFn(),
    create: mockFn(),
    update: mockFn(),
    delete: mockFn(),
    findMany: mockFn([]),
    count: mockFn(0)
  },
  auditLog: {
    create: mockAuditLogCreate,
    findMany: mockFn([]),
    count: mockFn(0)
  },
  $transaction: jest.fn((callback) => callback(module.exports))
}