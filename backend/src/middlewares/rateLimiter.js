// ============================================================
// RATE LIMITER MEJORADO
// ============================================================

const rateLimit = require('express-rate-limit')

/**
 * Helper to safely get IP address (IPv4/IPv6 compatible)
 */
const getKeyGenerator = (getKey) => (req) => {
  try {
    // Use express-rate-limit's built-in IP extraction for IPv6 compatibility
    const { ipKeyGenerator } = require('express-rate-limit')
    return getKey(req, ipKeyGenerator)
  } catch {
    // Fallback if helper not available
    return getKey(req, (r) => r.ip || r.headers['x-forwarded-for'] || 'unknown')
  }
}

/**
 * Rate limiter factory - returns a function that creates limiters
 * Allows disabling in test environment
 */
const createLimiter = (options) => {
  // Disable rate limiting in test environment
  if (process.env.NODE_ENV === 'test') {
    return (req, res, next) => next()
  }
  return rateLimit(options)
}

/**
 * Configuración de rate limiting por defecto
 */
const defaultLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // límite por IP
  message: {
    error: 'Demasiadas solicitudes',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: '15 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getKeyGenerator((req, ipKeyGenerator) => 
    req.usuario?.id || ipKeyGenerator(req)
  ),
  handler: (req, res) => {
    res.status(429).json({
      error: 'Demasiadas solicitudes desde esta IP',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: '15 minutos'
    })
  }
})

/**
 * Rate limiter estricto para autenticación
 */
const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // solo 5 intentos por 15 min
  message: {
    error: 'Demasiados intentos de login',
    code: 'AUTH_RATE_LIMIT',
    retryAfter: '15 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getKeyGenerator((req, ipKeyGenerator) => 
    req.body?.email || ipKeyGenerator(req)
  ),
  skipSuccessfulRequests: true, // no contar requests exitosos
  handler: (req, res) => {
    res.status(429).json({
      error: 'Demasiados intentos de login. Intente en 15 minutos.',
      code: 'AUTH_RATE_LIMIT',
      retryAfter: '15 minutos'
    })
  }
})

/**
 * Rate limiter para ventas/POS (operaciones críticas)
 */
const ventasLimiter = createLimiter({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 30, // 30 ventas por minuto
  message: {
    error: 'Límite de ventas excedido',
    code: 'VENTAS_RATE_LIMIT',
    retryAfter: '1 minuto'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getKeyGenerator((req, ipKeyGenerator) => 
    req.usuario?.id || ipKeyGenerator(req)
  )
})

/**
 * Rate limiter para APIs generales
 */
const apiLimiter = createLimiter({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 60, // 60 requests por minuto
  message: {
    error: 'Demasiadas solicitudes a la API',
    code: 'API_RATE_LIMIT',
    retryAfter: '1 minuto'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getKeyGenerator((req, ipKeyGenerator) => 
    req.usuario?.id || ipKeyGenerator(req)
  )
})

/**
 * Rate limiter estricto para operaciones de admin
 */
const adminLimiter = createLimiter({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 20, // 20 requests por minuto
  message: {
    error: 'Límite de operaciones admin excedido',
    code: 'ADMIN_RATE_LIMIT',
    retryAfter: '1 minuto'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getKeyGenerator((req, ipKeyGenerator) => 
    req.usuario?.id || ipKeyGenerator(req)
  )
})

/**
 * Rate limiter para reportes/exportaciones (operaciones pesadas)
 */
const reportesLimiter = createLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 10, // 10 reportes por 5 minutos
  message: {
    error: 'Límite de generación de reportes excedido',
    code: 'REPORTES_RATE_LIMIT',
    retryAfter: '5 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getKeyGenerator((req, ipKeyGenerator) => 
    req.usuario?.id || ipKeyGenerator(req)
  )
})

module.exports = {
  defaultLimiter,
  authLimiter,
  ventasLimiter,
  apiLimiter,
  adminLimiter,
  reportesLimiter
}