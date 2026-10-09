// ============================================================
// AUTH ROUTES — REFACTORIZADA
// ============================================================

const express = require('express')
const auth = require('../services')
const { validate, validateParams } = require('../middlewares/validate')
const { asyncHandler } = require('../utils/errors')
const { loginSchema, registerSchema, idParamSchema } = require('../schemas')
const { authMiddleware, soloAdmin } = require('../middlewares/auth')
const { authLimiter } = require('../middlewares/rateLimiter')

const router = express.Router()

/**
 * POST /api/auth/login
 */
router.post('/login',
  authLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body
    const { token, refreshToken, usuario } = await auth.auth.login({ email, password })

    res.status(200).json({
      token,
      refreshToken,
      usuario
    })
  })
)

/**
 * GET /api/auth/me
 */
router.get('/me',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const usuario = await auth.auth.getProfile({ userId: req.usuario.id })
    res.status(200).json(usuario)
  })
)

/**
 * POST /api/auth/register (solo ADMIN)
 */
router.post('/register',
  authLimiter,
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    if (req.usuario.rol !== 'ADMIN') {
      return res.status(403).json({ error: 'Solo el administrador puede crear usuarios' })
    }

    const { nombre, email, password, rol } = req.body
    const usuario = await auth.auth.register({ nombre, email, password, rol })

    res.status(201).json({
      mensaje: 'Usuario creado exitosamente',
      usuario
    })
  })
)

/**
 * POST /api/auth/refresh - Renovar token
 */
router.post('/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token requerido' })
    }

    const { token, refreshToken: newRefreshToken, usuario } = await auth.auth.refreshToken(refreshToken)

    res.status(200).json({
      token,
      refreshToken: newRefreshToken,
      usuario
    })
  })
)

module.exports = router