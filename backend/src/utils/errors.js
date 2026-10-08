// ============================================================
// ERROR HANDLER CENTRALIZADO
// ============================================================

/**
 * Clases de error personalizadas
 */

class AppError extends Error {
  constructor(message, statusCode, code, details = null) {
    super(message)
    this.statusCode = statusCode
    this.code = code
    this.details = details
    this.isOperational = true
    Error.captureStackTrace(this, this.constructor)
  }
}

class ValidationError extends AppError {
  constructor(message, details) {
    super(message, 400, 'VALIDATION_ERROR', details)
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Recurso') {
    super(`${resource} no encontrado`, 404, 'NOT_FOUND')
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'No autorizado') {
    super(message, 401, 'UNAUTHORIZED')
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Acceso denegado') {
    super(message, 403, 'FORBIDDEN')
  }
}

class ConflictError extends AppError {
  constructor(message) {
    super(message, 409, 'CONFLICT')
  }
}

class InternalError extends AppError {
  constructor(message = 'Error interno del servidor') {
    super(message, 500, 'INTERNAL_ERROR')
  }
}

/**
 * Middleware de manejo de errores global
 */
const errorHandler = (err, req, res, next) => {
  // Log del error
  console.error('❌ Error:', {
    message: err.message,
    stack: err.stack,
    name: err.name,
    path: req.path,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query,
    usuario: req.usuario?.id
  })
  
  // Si es error operacional conocido
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      ...(err.details && { details: err.details })
    })
  }
  
  // Errores de Prisma
  if (err.code === 'P2002') {
    return res.status(409).json({
      error: 'Recurso duplicado',
      code: 'CONFLICT',
      details: err.meta?.target || 'Registro ya existe'
    })
  }
  
  if (err.code === 'P2025') {
    return res.status(404).json({
      error: 'Recurso no encontrado',
      code: 'NOT_FOUND'
    })
  }
  
  // Errores de validación Zod
  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'Error de validación',
      code: 'VALIDATION_ERROR',
      details: err.errors.map(e => ({
        field: e.path.join('.').replace('[]', '[0]'),
        message: e.message
      }))
    })
  }
  
  // Errores de JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Token inválido',
      code: 'UNAUTHORIZED'
    })
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expirado',
      code: 'UNAUTHORIZED'
    })
  }
  
  // Error no manejado - 500
  return res.status(500).json({
    error: 'Error interno del servidor',
    code: 'INTERNAL_ERROR'
  })
}

/**
 * Wrapper para async handlers en Express
 * Evita try/catch repetitivo
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  InternalError,
  errorHandler,
  asyncHandler
}