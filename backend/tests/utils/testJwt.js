/**
 * JWT Test Utility - generates valid JWT tokens for testing
 */
const jwt = require('jsonwebtoken')

const TEST_JWT_SECRET = 'test_secret_jwt_for_tests_mya_backend'

/**
 * Generate a valid JWT token for testing
 * @param {Object} payload - Token payload (e.g., { id: 1, nombre: 'Test', rol: 'ADMIN' })
 * @param {string} expiresIn - Token expiration (default: '12h')
 * @returns {string} JWT token
 */
function generateTestToken(payload, expiresIn = '12h') {
  return jwt.sign(payload, TEST_JWT_SECRET, { expiresIn })
}

/**
 * Generate an expired JWT token for testing
 * @param {Object} payload - Token payload
 * @returns {string} Expired JWT token
 */
function generateExpiredToken(payload) {
  return jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: '-1s' })
}

/**
 * Generate a malformed JWT token for testing
 * @returns {string} Invalid token
 */
function generateMalformedToken() {
  return 'this.is.not.a.valid.jwt.token.at.all'
}

module.exports = {
  generateTestToken,
  generateExpiredToken,
  generateMalformedToken,
  TEST_JWT_SECRET
}