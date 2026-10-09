// ============================================================
// TEST SETUP — BACKEND
// ============================================================

// Set test environment BEFORE any modules load
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test_secret_jwt_for_tests_mya_backend'

const { createMockPrisma } = require('./utils/mockPrisma')

// Create and install mock Prisma BEFORE any modules are loaded
const mockPrisma = createMockPrisma()

// Mock @prisma/client module
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma)
}))

// Mock src/lib/prisma to return the same mock
jest.mock('../src/lib/prisma', () => mockPrisma)

// Global test setup
beforeAll(async () => {
  console.log('🧪 Iniciando tests del backend...')
})

afterAll(async () => {
  console.log('✅ Tests del backend completados')
})

// Mock console.error to avoid noise in tests
const originalError = console.error
beforeAll(() => {
  console.error = (...args) => {
    if (typeof args[0] === 'string' && args[0].includes('Audit log error')) {
      return // Suppress audit log errors in tests
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
})

// Global test timeout
jest.setTimeout(10000)

// Export mock for tests that need it
module.exports.mockPrisma = mockPrisma