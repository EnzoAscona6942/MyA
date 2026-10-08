/**
 * Mock Prisma Factory - creates mock Prisma client with all models
 * Used for backend integration tests
 */
function createMockPrisma(overrides = {}) {
  // Use jest.fn() which has mockResolvedValue, mockRejectedValue built-in
  // The key is that when called, it must return a Promise that has .catch()
  const createMockFn = (returnValue = null) => {
    // Use jest.fn() - it has .mockResolvedValue(), .mockRejectedValue() built-in
    // And when called, returns a Promise that has .catch()
    return jest.fn(() => Promise.resolve(returnValue))
  }

  const defaultMocks = {
    // Usuario model
    usuario: {
      findUnique: createMockFn(),
      findFirst: createMockFn(),
      create: createMockFn(),
      update: createMockFn(),
      delete: createMockFn(),
      findMany: createMockFn([]),
      count: createMockFn(0)
    },
    // Producto model
    producto: {
      findUnique: createMockFn(),
      findFirst: createMockFn(),
      create: createMockFn(),
      update: createMockFn(),
      delete: createMockFn(),
      findMany: createMockFn([]),
      count: createMockFn(0)
    },
    // Venta model
    venta: {
      findUnique: createMockFn(),
      findFirst: createMockFn(),
      create: createMockFn(),
      update: createMockFn(),
      findMany: createMockFn([]),
      count: createMockFn(0),
      aggregate: createMockFn({ _sum: { total: 0 }, _count: { id: 0 } }),
      groupBy: createMockFn([])
    },
    // VentaItem model
    ventaItem: {
      findUnique: createMockFn(),
      findMany: createMockFn([]),
      create: createMockFn()
    },
    // Caja model
    caja: {
      findUnique: createMockFn(),
      findFirst: createMockFn(),
      create: createMockFn(),
      update: createMockFn(),
      findMany: createMockFn([]),
      count: createMockFn(0)
    },
    // MovimientoCaja model
    movimientoCaja: {
      findUnique: createMockFn(),
      findFirst: createMockFn(),
      create: createMockFn(),
      findMany: createMockFn([]),
      count: createMockFn(0)
    },
    // Categoria model
    categoria: {
      findUnique: createMockFn(),
      findFirst: createMockFn(),
      create: createMockFn(),
      update: createMockFn(),
      delete: createMockFn(),
      findMany: createMockFn([]),
      count: createMockFn(0)
    },
    // Proveedor model
    proveedor: {
      findUnique: createMockFn(),
      findFirst: createMockFn(),
      create: createMockFn(),
      update: createMockFn(),
      delete: createMockFn(),
      findMany: createMockFn([]),
      count: createMockFn(0)
    },
    // IngresoStock model
    ingresoStock: {
      findUnique: createMockFn(),
      findFirst: createMockFn(),
      create: createMockFn(),
      update: createMockFn(),
      findMany: createMockFn([]),
      count: createMockFn(0)
    },
    // IngresoStockItem model
    ingresoStockItem: {
      findUnique: createMockFn(),
      findMany: createMockFn([]),
      create: createMockFn()
    },
    // AuditLog model - CRITICAL for audit middleware
    auditLog: {
      create: createMockFn({ id: 1 }), // Returns promise that resolves
      findMany: createMockFn([]),
      count: createMockFn(0)
    },
    // $transaction - passthrough for tests
    $transaction: jest.fn((callback) => callback(defaultMocks))
  }

  // Merge default mocks with overrides
  const merged = {}
  for (const [key, value] of Object.entries(defaultMocks)) {
    if (overrides[key]) {
      // Merge each method from overrides
      merged[key] = { ...value, ...overrides[key] }
    } else {
      merged[key] = value
    }
  }

  return merged
}

/**
 * Reset all mocks - call before each test
 */
function resetMockPrisma(mockPrisma) {
  for (const model of Object.values(mockPrisma)) {
    for (const method of Object.keys(model)) {
      if (typeof model[method].mockClear === 'function') {
        model[method].mockClear()
      }
      // Reset the implementation to return Promise.resolve(defaultValue)
      // This is a bit hacky but works
      const fn = model[method]
      if (fn && typeof fn.mockImplementation === 'function') {
        // Get the original return value from the function
        // We'll just reset it to return null by default
        fn.mockImplementation(() => Promise.resolve(null))
      }
    }
  }
}

/**
 * Helper to set up successful Prisma responses
 */
function mockPrismaSuccess(mockPrisma, model, method, returnValue) {
  const fn = mockPrisma[model][method]
  if (fn && typeof fn.mockResolvedValue === 'function') {
    fn.mockResolvedValue(returnValue)
  } else if (fn) {
    // Fallback if no mockResolvedValue
    mockPrisma[model][method] = jest.fn(() => Promise.resolve(returnValue))
  }
}

function mockPrismaError(mockPrisma, model, method, error) {
  const fn = mockPrisma[model][method]
  if (fn && typeof fn.mockRejectedValue === 'function') {
    fn.mockRejectedValue(error)
  } else if (fn) {
    mockPrisma[model][method] = jest.fn(() => Promise.reject(error))
  }
}

module.exports = {
  createMockPrisma,
  resetMockPrisma,
  mockPrismaSuccess,
  mockPrismaError
}