// ============================================================
// VALIDATION MIDDLEWARE — ZOD INTEGRATION
// ============================================================

const { ZodError } = require('zod')

/**
 * Middleware to validate request body against Zod schema
 */
const validate = (schema) => (req, res, next) => {
  try {
    // Validate request body against schema
    const validatedData = schema.parse(req.body)
    
    // Replace request body with validated data
    req.body = validatedData
    
    next()
  } catch (error) {
    if (error instanceof ZodError) {
      // Zod v3 uses .issues instead of .errors
      const issues = error.issues || error.errors || []
      return res.status(400).json({
        error: 'Error de validación',
        details: issues.map(err => ({
          field: err.path.join('.').replace('[]', '[0]'),
          message: err.message
        }))
      })
    }
    
    // Unknown error
    next(error)
  }
}

/**
 * Middleware to validate URL parameters against Zod schema
 */
const validateParams = (schema) => (req, res, next) => {
  try {
    // Validate request parameters against schema
    const validatedData = schema.parse(req.params)
    
    // Replace request parameters with validated data
    req.params = { ...req.params, ...validatedData }
    
    next()
  } catch (error) {
    if (error instanceof ZodError) {
      const issues = error.issues || error.errors || []
      return res.status(400).json({
        error: 'Error de validación de parámetros',
        details: issues.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      })
    }
    
    // Unknown error
    next(error)
  }
}

/**
 * Middleware to validate query parameters against Zod schema
 */
const validateQuery = (schema) => (req, res, next) => {
  try {
    // Validate request query against schema
    const validatedData = schema.parse(req.query)
    
    // Replace request query with validated data
    req.query = { ...req.query, ...validatedData }
    
    next()
  } catch (error) {
    if (error instanceof ZodError) {
      const issues = error.issues || error.errors || []
      return res.status(400).json({
        error: 'Error de validación de query',
        details: issues.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      })
    }
    
    // Unknown error
    next(error)
  }
}

module.exports = {
  validate,
  validateParams,
  validateQuery
}