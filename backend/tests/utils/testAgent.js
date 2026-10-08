/**
 * Test Agent Utility - Supertest wrapper for Express app
 */
const request = require('supertest')

/**
 * Create a supertest agent for the Express app
 * @param {Object} app - Express application
 * @returns {Object} Supertest agent
 */
function createTestAgent(app) {
  return request(app)
}

/**
 * Helper to make authenticated requests
 * @param {Object} agent - Supertest agent
 * @param {string} token - JWT token
 * @returns {Object} Agent with Authorization header set
 */
function withAuth(agent, token) {
  return agent.set('Authorization', `Bearer ${token}`)
}

module.exports = {
  createTestAgent,
  withAuth
}