const express = require('express')
const prisma = require('../lib/prisma')
const { authMiddleware, soloAdmin } = require('../middlewares/auth')

const router = express.Router()

// ── CATEGORÍAS ──────────────────────────────────────────────

// GET /api/categorias
router.get('/categorias', authMiddleware, async (req, res) => {
  try {
    const categorias = await prisma.categoria.findMany({
      orderBy: { nombre: 'asc' }
    })
    res.json(categorias)
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener categorías' })
  }
})

// POST /api/categorias
router.post('/categorias', authMiddleware, soloAdmin, async (req, res) => {
  const { nombre, descripcion } = req.body
  if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' })

  try {
    const categoria = await prisma.categoria.create({ data: { nombre, descripcion } })
    res.status(201).json(categoria)
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'La categoría ya existe' })
    res.status(500).json({ error: 'Error al crear categoría' })
  }
})

// PUT /api/categorias/:id
router.put('/categorias/:id', authMiddleware, soloAdmin, async (req, res) => {
  const { nombre, descripcion } = req.body
  try {
    const categoria = await prisma.categoria.update({
      where: { id: parseInt(req.params.id) },
      data: { ...(nombre && { nombre }), ...(descripcion !== undefined && { descripcion }) }
    })
    res.json(categoria)
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Categoría no encontrada' })
    res.status(500).json({ error: 'Error al actualizar categoría' })
  }
})

// DELETE /api/categorias/:id
router.delete('/categorias/:id', authMiddleware, soloAdmin, async (req, res) => {
  try {
    await prisma.categoria.delete({ where: { id: parseInt(req.params.id) } })
    res.json({ mensaje: 'Categoría eliminada' })
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Categoría no encontrada' })
    res.status(500).json({ error: 'Error al eliminar categoría' })
  }
})

// ── PROVEEDORES ─────────────────────────────────────────────

// GET /api/proveedores
router.get('/proveedores', authMiddleware, async (req, res) => {
  try {
    const proveedores = await prisma.proveedor.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' }
    })
    res.json(proveedores)
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener proveedores' })
  }
})

// POST /api/proveedores
router.post('/proveedores', authMiddleware, soloAdmin, async (req, res) => {
  const { nombre, contacto, telefono, email } = req.body
  if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' })

  try {
    const proveedor = await prisma.proveedor.create({
      data: { nombre, contacto, telefono, email }
    })
    res.status(201).json(proveedor)
  } catch (err) {
    res.status(500).json({ error: 'Error al crear proveedor' })
  }
})

// PUT /api/proveedores/:id
router.put('/proveedores/:id', authMiddleware, soloAdmin, async (req, res) => {
  const { nombre, contacto, telefono, email, activo } = req.body
  try {
    const proveedor = await prisma.proveedor.update({
      where: { id: parseInt(req.params.id) },
      data: {
        ...(nombre && { nombre }),
        ...(contacto !== undefined && { contacto }),
        ...(telefono !== undefined && { telefono }),
        ...(email !== undefined && { email }),
        ...(activo !== undefined && { activo })
      }
    })
    res.json(proveedor)
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Proveedor no encontrado' })
    res.status(500).json({ error: 'Error al actualizar proveedor' })
  }
})

module.exports = router
