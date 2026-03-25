const prisma = require('../lib/prisma')

/**
 * Async audit logging middleware - non-blocking
 * Logs all API actions to AuditLog table without waiting for DB response
 */
const auditMiddleware = (req, res, next) => {
  // Capture original send to log after response is sent
  const originalSend = res.send
  
  res.send = function(body) {
    // Determine action based on HTTP method
    let action = 'READ'
    if (req.method === 'POST') action = 'CREATE'
    else if (req.method === 'PUT' || req.method === 'PATCH') action = 'UPDATE'
    else if (req.method === 'DELETE') action = 'DELETE'
    
    // Extract resource from route
    const pathParts = req.path.split('/').filter(Boolean)
    const resource = pathParts[0] || 'unknown'
    
    // Get user ID if authenticated
    const usuarioId = req.user ? req.user.id : null
    
    // Extract resource ID if present in path
    let resourceId = null
    const idMatch = req.path.match(/\/(\d+)(?:\/|$)/)
    if (idMatch) {
      resourceId = parseInt(idMatch[1])
    }
    
    // Build details object
    const details = JSON.stringify({
      method: req.method,
      path: req.path,
      query: req.query,
      body: req.method !== 'GET' ? req.body : undefined
    })
    
    // Async non-blocking audit log write
    // Don't await - fire and forget
    prisma.auditLog.create({
      data: {
        action,
        resource,
        resourceId,
        details,
        ipAddress: req.ip || req.connection.remoteAddress,
        usuarioId
      }
    }).catch(err => {
      // Log error but don't block the response
      console.error('Audit log error:', err.message)
    })
    
    // Call original send
    return originalSend.call(this, body)
  }
  
  next()
}

module.exports = { auditMiddleware }
