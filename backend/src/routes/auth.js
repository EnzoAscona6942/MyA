const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const prisma = require('../lib/prisma')
const { authMiddleware } = require('../middlewares/auth')
const { body, validationResult } = require('express-validator')

const router = express.Router()

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Error de validación',
      details: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    })
  }
  next()
}

// POST /api/auth/login
router.post('/login',
  [
    body('email').isEmail().withMessage('El email debe ser válido'),
    body('password').notEmpty().withMessage('El password es requerido')
  ],
  validate,
  async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y password requeridos' })
  }

  try {
    const usuario = await prisma.usuario.findUnique({ where: { email } })

    if (!usuario || !usuario.activo) {
      return res.status(401).json({ error: 'Credenciales inválidas' })
    }

    const passwordValido = await bcrypt.compare(password, usuario.password)
    if (!passwordValido) {
      return res.status(401).json({ error: 'Credenciales inválidas' })
    }

    const token = jwt.sign(
      { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    )

    res.json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol
      }
    })
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.usuario.id },
      select: { id: true, nombre: true, email: true, rol: true }
    })
    res.json(usuario)
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// POST /api/auth/register (solo ADMIN puede crear usuarios)
router.post('/register',
  authMiddleware,
  [
    body('nombre').notEmpty().withMessage('El nombre es requerido'),
    body('email').isEmail().withMessage('El email debe ser válido'),
    body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
    body('rol').optional().isIn(['ADMIN', 'CAJERO']).withMessage('El rol debe ser ADMIN o CAJERO')
  ],
  validate,
  async (req, res) => {
    if (req.usuario.rol !== 'ADMIN') {
      return res.status(403).json({ error: 'Solo el administrador puede crear usuarios' })
    }

    const { nombre, email, password, rol } = req.body

    try {
    const existe = await prisma.usuario.findUnique({ where: { email } })
    if (existe) {
      return res.status(400).json({ error: 'El email ya está registrado' })
    }

    const hash = await bcrypt.hash(password, 10)
    const usuario = await prisma.usuario.create({
      data: { nombre, email, password: hash, rol: rol || 'CAJERO' },
      select: { id: true, nombre: true, email: true, rol: true }
    })

    res.status(201).json(usuario)
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

module.exports = router
