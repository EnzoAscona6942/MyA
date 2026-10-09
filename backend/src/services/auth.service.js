// ============================================================
// AUTH SERVICE — LÓGICA DE NEGOCIO
// ============================================================

const prisma = require('../lib/prisma')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const { loginSchema, registerSchema } = require('../schemas')
const { UnauthorizedError, ConflictError, NotFoundError } = require('../utils/errors')

const JWT_SECRET = process.env.JWT_SECRET || 'cambiar-por-variables-entorno'
const JWT_EXPIRES_IN = '1h'
const JWT_REFRESH_EXPIRES_IN = '7d'

/**
 * Login de usuario con validación robusta
 */
const login = async ({ email, password }) => {
  // 1. Validar con Zod
  const data = loginSchema.parse({ email, password })

  // 2. Buscar usuario en base de datos
  const user = await prisma.usuario.findUnique({ where: { email } })
  if (!user) {
    throw new UnauthorizedError('Credenciales inválidas')
  }

  // 3. Verificar que el usuario esté activo
  if (!user.activo) {
    throw new UnauthorizedError('La cuenta está desactivada')
  }

  // 4. Comparar contraseña
  const passwordValido = await bcrypt.compare(password, user.password)
  if (!passwordValido) {
    throw new UnauthorizedError('Credenciales inválidas')
  }

  // 5. Generar JWT + refresh token
  const payload = {
    id: user.id,
    nombre: user.nombre,
    rol: user.rol
  }

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
  const refreshToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN })

  // 6. Retornar datos (sin contraseña)
  return {
    token,
    refreshToken,
    usuario: {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol
    }
  }
}

/**
 * Registro de nuevo usuario (solo admin)
 */
const register = async ({ nombre, email, password, rol }) => {
  // 1. Validar con Zod
  const data = registerSchema.parse({ nombre, email, password, rol })

  // 2. Verificar que el email no exista
  const existe = await prisma.usuario.findUnique({ where: { email } })
  if (existe) {
    throw new ConflictError('El email ya está registrado')
  }

  // 3. Hashear contraseña
  const hash = await bcrypt.hash(password, 10)

  // 4. Crear usuario
  const nuevoUsuario = await prisma.usuario.create({
    data: {
      nombre: data.nombre,
      email: data.email,
      password: hash,
      rol: data.rol
    },
    select: {
      id: true,
      nombre: true,
      email: true,
      rol: true
    }
  })

  return nuevoUsuario
}

/**
 * Renovar token (refresh token flow)
 */
const refreshToken = async (refreshToken) => {
  try {
    const payload = jwt.verify(refreshToken, JWT_SECRET)

    // 1. Buscar usuario
    const user = await prisma.usuario.findUnique({ where: { id: payload.id } })
    if (!user || !user.activo) {
      throw new UnauthorizedError('Usuario no encontrado o inactivo')
    }

    // 2. Generar nuevos tokens
    const payloadNew = {
      id: user.id,
      nombre: user.nombre,
      rol: user.rol
    }

    const token = jwt.sign(payloadNew, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
    const refreshTokenNew = jwt.sign(payloadNew, JWT_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN })

    return {
      token,
      refreshToken: refreshTokenNew,
      usuario: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol
      }
    }
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      throw new UnauthorizedError('Token inválido')
    }
    if (error.name === 'TokenExpiredError') {
      throw new UnauthorizedError('Token expirado')
    }
    throw error
  }
}

/**
 * Obtener perfil de usuario autenticado
 */
const getProfile = async ({ userId }) => {
  const user = await prisma.usuario.findUnique({
    where: { id: userId },
    select: {
      id: true,
      nombre: true,
      email: true,
      rol: true
    }
  })

  if (!user) {
    throw new NotFoundError('Usuario')
  }

  return user
}

module.exports = {
  login,
  register,
  refreshToken,
  getProfile
}