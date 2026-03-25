const express = require('express')
const bcrypt = require('bcryptjs')
const prisma = require('../lib/prisma')
const { authMiddleware, soloAdmin } = require('../middlewares/auth')

const router = express.Router()

/**
 * GET /api/usuarios — Listar todos los usuarios (solo ADMIN)
 */
router.get('/', authMiddleware, soloAdmin, async (req, res) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        activo: true,
        creadoEn: true
      },
      orderBy: {
        creadoEn: 'desc'
      }
    })
    res.json(usuarios)
  } catch (err) {
    console.error('Error fetching usuarios:', err)
    res.status(500).json({ error: 'Error al obtener usuarios' })
  }
})

/**
 * GET /api/usuarios/:id — Obtener un usuario específico
 */
router.get('/:id', authMiddleware, soloAdmin, async (req, res) => {
  const { id } = req.params
  
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: parseInt(id) },
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        activo: true,
        creadoEn: true
      }
    })
    
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }
    
    res.json(usuario)
  } catch (err) {
    console.error('Error fetching usuario:', err)
    res.status(500).json({ error: 'Error al obtener usuario' })
  }
})

/**
 * PUT /api/usuarios/:id — Actualizar usuario (solo ADMIN)
 */
router.put('/:id', authMiddleware, soloAdmin, async (req, res) => {
  const { id } = req.params
  const { nombre, email, rol, activo, password } = req.body

  // Validaciones
  if (!nombre || !email) {
    return res.status(400).json({ error: 'Nombre y email son requeridos' })
  }

  // Validación de email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Email inválido' })
  }

  try {
    // Verificar que existe
    const existente = await prisma.usuario.findUnique({
      where: { id: parseInt(id) }
    })
    
    if (!existente) {
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }

    // Verificar email único (si cambia)
    if (email !== existente.email) {
      const emailExiste = await prisma.usuario.findUnique({
        where: { email }
      })
      if (emailExiste) {
        return res.status(409).json({ error: 'El email ya está en uso' })
      }
    }

    // Construir update data
    const updateData = {
      nombre,
      email,
      rol: rol || existente.rol,
      activo: activo !== undefined ? activo : existente.activo
    }

    // Si proporciona password, actualizarlo
    if (password && password.trim()) {
      updateData.password = await bcrypt.hash(password, 10)
    }

    const usuario = await prisma.usuario.update({
      where: { id: parseInt(id) },
      data: updateData,
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        activo: true
      }
    })

    res.json(usuario)
  } catch (err) {
    console.error('Error updating usuario:', err)
    res.status(500).json({ error: 'Error al actualizar usuario' })
  }
})

/**
 * DELETE /api/usuarios/:id — Desactivar usuario (solo ADMIN)
 */
router.delete('/:id', authMiddleware, soloAdmin, async (req, res) => {
  const { id } = req.params

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: parseInt(id) }
    })

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }

    // No permitir eliminar al último ADMIN
    if (usuario.rol === 'ADMIN') {
      const adminsActivos = await prisma.usuario.count({
        where: { rol: 'ADMIN', activo: true }
      })
      
      if (adminsActivos <= 1) {
        return res.status(400).json({ error: 'No se puede eliminar el último administrador' })
      }
    }

    // Desactivar en lugar de eliminar (soft delete)
    await prisma.usuario.update({
      where: { id: parseInt(id) },
      data: { activo: false }
    })

    res.json({ message: 'Usuario desactivado correctamente' })
  } catch (err) {
    console.error('Error deleting usuario:', err)
    res.status(500).json({ error: 'Error al desactivar usuario' })
  }
})

/**
 * PUT /api/usuarios/:id/activar — Activar usuario (solo ADMIN)
 */
router.put('/:id/activar', authMiddleware, soloAdmin, async (req, res) => {
  const { id } = req.params

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: parseInt(id) }
    })

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }

    const actualizado = await prisma.usuario.update({
      where: { id: parseInt(id) },
      data: { activo: true },
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        activo: true
      }
    })

    res.json(actualizado)
  } catch (err) {
    console.error('Error activating usuario:', err)
    res.status(500).json({ error: 'Error al activar usuario' })
  }
})

module.exports = router