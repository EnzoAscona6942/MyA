/**
 * Auth Route Integration Tests
 * 
 * Tests for POST /api/auth/login and GET /api/auth/me
 * 
 * Scenarios from spec:
 * - Successful login returns JWT
 * - Login with invalid credentials fails
 * - Valid JWT token grants access
 * - Invalid JWT token rejects request
 * - Expired JWT token rejects request
 */
const request = require('supertest')
const bcrypt = require('bcryptjs')

// Import mock utilities
const { createMockPrisma, resetMockPrisma, mockPrismaSuccess, mockPrismaError } = require('../utils/mockPrisma')
const { generateTestToken, generateExpiredToken, generateMalformedToken } = require('../utils/testJwt')

// Import app - Prisma is already mocked in tests/setup.js
const app = require('../../src/server')

// Get the mocked prisma instance from the module
const prisma = require('../../src/lib/prisma')

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    resetMockPrisma(prisma)
  })

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    resetMockPrisma(prisma)
  })

  test('should return 200 and token with valid credentials', async () => {
    // Given: user exists with valid password
    const hashedPassword = await bcrypt.hash('password123', 10)
    const mockUser = {
      id: 1,
      nombre: 'Test User',
      email: 'test@example.com',
      password: hashedPassword,
      rol: 'ADMIN',
      activo: true
    }
    mockPrismaSuccess(prisma, 'usuario', 'findUnique', mockUser)

    // When: POST request with valid credentials
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' })

    // Then: response has token and user
    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty('token')
    expect(response.body).toHaveProperty('usuario')
    expect(response.body.usuario.email).toBe('test@example.com')
  })

  test('should return 401 with invalid password', async () => {
    // Given: user exists with password "correctpassword"
    const hashedPassword = await bcrypt.hash('correctpassword', 10)
    const mockUser = {
      id: 1,
      nombre: 'Test User',
      email: 'test@example.com',
      password: hashedPassword,
      rol: 'ADMIN',
      activo: true
    }
    mockPrismaSuccess(prisma, 'usuario', 'findUnique', mockUser)

    // When: POST request with wrong password
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'wrongpassword' })

    // Then: response is 401
    expect(response.status).toBe(401)
    expect(response.body).toHaveProperty('error')
  })

  test('should return 401 with non-existent email', async () => {
    // Given: no user exists with this email
    mockPrismaSuccess(prisma, 'usuario', 'findUnique', null)

    // When: POST request with non-existent email
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nonexistent@example.com', password: 'password123' })

    // Then: response is 401
    expect(response.status).toBe(401)
    expect(response.body).toHaveProperty('error')
  })

  test('should return 401 when user is inactive', async () => {
    // Given: user exists but is inactive
    const hashedPassword = await bcrypt.hash('password123', 10)
    const mockUser = {
      id: 1,
      nombre: 'Test User',
      email: 'test@example.com',
      password: hashedPassword,
      rol: 'ADMIN',
      activo: false
    }
    mockPrismaSuccess(prisma, 'usuario', 'findUnique', mockUser)

    // When: POST request
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' })

    // Then: response is 401
    expect(response.status).toBe(401)
  })

  test('should return 400 when email is missing', async () => {
    // When: POST request without email
    const response = await request(app)
      .post('/api/auth/login')
      .send({ password: 'password123' })

    // Then: response is 400
    expect(response.status).toBe(400)
  })
})

describe('GET /api/auth/me', () => {
  beforeEach(() => {
    resetMockPrisma(prisma)
  })

  test('should return 200 with valid token', async () => {
    // Given: valid JWT token
    const token = generateTestToken({ id: 1, nombre: 'Test User', rol: 'ADMIN' })
    const mockUser = { id: 1, nombre: 'Test User', email: 'test@example.com', rol: 'ADMIN' }
    mockPrismaSuccess(prisma, 'usuario', 'findUnique', mockUser)

    // When: GET request with valid token
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)

    // Then: response has user data
    expect(response.status).toBe(200)
    expect(response.body.nombre).toBe('Test User')
  })

  test('should return 401 with missing token', async () => {
    // When: GET request without token
    const response = await request(app)
      .get('/api/auth/me')

    // Then: response is 401
    expect(response.status).toBe(401)
    expect(response.body).toHaveProperty('error')
  })

  test('should return 403 with expired token', async () => {
    // Given: expired JWT token
    const token = generateExpiredToken({ id: 1, nombre: 'Test User', rol: 'ADMIN' })

    // When: GET request with expired token
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)

    // Then: response is 403
    expect(response.status).toBe(403)
    expect(response.body).toHaveProperty('error')
  })

  test('should return 403 with malformed token', async () => {
    // Given: malformed JWT token
    const token = generateMalformedToken()

    // When: GET request with malformed token
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)

    // Then: response is 403
    expect(response.status).toBe(403)
  })
})
})