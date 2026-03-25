const rateLimit = require('express-rate-limit')

/**
 * Rate limiter for authentication routes (login, register)
 * 5 requests per minute to prevent brute force attacks
 */
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute
  message: { error: 'Demasiados intentos. Intenta de nuevo en un minuto.' },
  standardHeaders: true,
  legacyHeaders: false
})

/**
 * Rate limiter for sensitive operations (POST/PUT/DELETE)
 * 100 requests per minute
 */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: { error: 'Demasiadas solicitudes. Intenta de nuevo en un minuto.' },
  standardHeaders: true,
  legacyHeaders: false
})

/**
 * Stricter rate limiter for POS/ventas endpoints
 * 100 requests per minute (per design decision)
 */
const ventasLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: { error: 'Demasiadas solicitudes en el POS. Intenta de nuevo en un minuto.' },
  standardHeaders: true,
  legacyHeaders: false
})

module.exports = {
  authLimiter,
  apiLimiter,
  ventasLimiter
}
