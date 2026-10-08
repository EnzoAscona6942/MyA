// ============================================================
// AUTH CONTROLLER
// ============================================================

const auth = require('../services')
const { asyncHandler } = require('../utils/errors')

/**
 * POST /api/auth/login
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body

  const { token, refreshToken, usuario } = await auth.auth.login({ email, password })

  res.status(200).json({
    token,
    refreshToken,
    usuario
  })
})

/**
 * POST /api/auth/register
 */
const register = asyncHandler(async (req, res) => {
  const { nombre, email, password, rol } = req.body

  const usuario = await auth.auth.register({ nombre, email, password, rol })

  res.status(201).json({
    mensaje: 'Usuario creado exitosamente',
    usuario
  })
})

/**
 * GET /api/auth/me
 */
const me = asyncHandler(async (req, res) => {
  const usuario = await auth.auth.getProfile({ userId: req.usuario.id })

  res.status(200).json(usuario)
})

/**
 * POST /api/auth/logout
 */
const logout = asyncHandler(async (req, res) => {
  // En este momento no se requiere lógica de logout (stateless JWT)
  res.status(200).json({
    mensaje: 'Sesión cerrada'
  })
})

module.exports = {
  login,
  register,
  me,
  logout
}