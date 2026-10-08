// Test loading app
const request = require('supertest')
const app = require('../src/server')

describe('App loading', () => {
  test('app should load', () => {
    expect(app).toBeDefined()
  });

  test('health check endpoint', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(200);
    
    expect(response.body).toHaveProperty('status', 'ok');
  });
});