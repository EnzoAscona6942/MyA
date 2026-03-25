const express = require('express')
const prisma = require('../lib/prisma')
const { authMiddleware, soloAdmin } = require('../middlewares/auth')

const router = express.Router()

/**
 * GET /api/audit — List audit logs with filters and pagination
 * Query params: usuarioId, action, resource, desde, hasta, page, limit
 */
router.get('/', authMiddleware, soloAdmin, async (req, res) => {
  const { usuarioId, action, resource, desde, hasta, page = '1', limit = '20' } = req.query

  try {
    // Build where clause
    const where = {}

    if (usuarioId) {
      where.usuarioId = parseInt(usuarioId)
    }

    if (action) {
      where.action = action.toUpperCase()
    }

    if (resource) {
      where.resource = resource.toLowerCase()
    }

    if (desde || hasta) {
      where.creadoEn = {}
      if (desde) {
        where.creadoEn.gte = new Date(desde)
      }
      if (hasta) {
        where.creadoEn.lte = new Date(hasta)
      }
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const take = parseInt(limit)

    // Get total count for pagination metadata
    const total = await prisma.auditLog.count({ where })

    // Get audit logs with user info
    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        usuario: {
          select: {
            id: true,
            nombre: true,
            email: true
          }
        }
      },
      orderBy: {
        creadoEn: 'desc'
      },
      skip,
      take
    })

    res.json({
      data: logs,
      meta: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (err) {
    console.error('Error fetching audit logs:', err)
    res.status(500).json({ error: 'Error al obtener logs de auditoría' })
  }
})

module.exports = router
