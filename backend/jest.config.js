module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  setupFiles: ['<rootDir>/tests/setup.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/server.js'
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  testTimeout: 30000,
  // Ensure mock is applied before any imports
  globals: {
    'process.env.NODE_ENV': 'test'
  }
}