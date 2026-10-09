// ============================================================
// VENTAS ROUTES — REFACTORIZADA
// ============================================================

const express = require('express')
const { z } = require('zod')
const ventas = require('../services')
const { validate, validateParams, validateQuery } = require('../middlewares/validate')
const { asyncHandler } = require('../utils/errors')
const { ventaSchema, idParamSchema, paginationSchema, busquedaSchema } = require('../schemas')
const { authMiddleware } = require('../middlewares/auth')
const { ventasLimiter } = require('../middlewares/rateLimiter')

const router = express.Router()

// Todas las rutas requieren autenticación
router.use(authMiddleware)
router.use(ventasLimiter)

/**
 * POST /api/ventas — registrar una venta completa
 */
router.post('/',
  validate(ventaSchema),
  asyncHandler(async (req, res) => {
    const { items, metodoPago, descuento, montoRecibido, cajaId, observaciones } = req.body

    const venta = await ventas.venta.crearVenta({
      items,
      cajaId,
      usuarioId: req.usuario.id,
      metodoPago,
      descuento,
      montoRecibido,
      observaciones
    })

    res.status(201).json(venta)
  })
)

/**
 * GET /api/ventas — listar ventas (con filtros por fecha, caja y paginación)
 */
router.get('/',
  validateQuery(paginationSchema.merge(busquedaSchema).extend({
    cajaId: z.coerce.number().int().positive().optional(),
    estado: z.enum(['COMPLETADA', 'ANULADA', 'PENDIENTE']).optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional()
  })),
  asyncHandler(async (req, res) => {
    const { from, to, cajaId, estado, skip = 0, take = 20 } = req.query

    const result = await ventas.venta.listarVentas({
      from,
      to,
      cajaId: cajaId ? Number(cajaId) : undefined,
      estado,
      skip: Number(skip),
      take: Number(take)
    })

    res.json(result)
  })
)

/**
 * GET /api/ventas/:id — detalle de una venta
 */
router.get('/:id',
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const venta = await ventas.venta.obtenerVenta({ ventaId: Number(req.params.id) })

    if (!venta) {
      return res.status(404).json({ error: 'Venta no encontrada' })
    }

    res.json(venta)
  })
)

/**
 * PUT /api/ventas/:id/anular — anular una venta y reponer stock
 */
router.put('/:id/anular',
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const result = await ventas.venta.anularVenta({ ventaId: Number(req.params.id) })
    res.json(result)
  })
)

module.exports = router