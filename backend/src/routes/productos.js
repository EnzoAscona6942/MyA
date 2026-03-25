const express = require('express')
const prisma = require('../lib/prisma')
const { authMiddleware, soloAdmin } = require('../middlewares/auth')
const { body, param, validationResult } = require('express-validator')

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

// GET /api/productos — listar todos (con filtros opcionales y paginación)
router.get('/', authMiddleware, async (req, res) => {
  const { busqueda, categoriaId, stockBajo, activo, skip, take } = req.query

  // Default pagination: 20 items per page
  const pageSize = take ? parseInt(take) : 20
  const offset = skip ? parseInt(skip) : 0

  try {
    let whereClause = {}

    // Handle stock bajo filter
    if (stockBajo === 'true') {
      // Raw SQL for stock <= stockMinimo
      const lowStock = await prisma.$queryRaw`
        SELECT id FROM productos
        WHERE stock <= "stockMinimo" AND activo = true
      `
      const ids = lowStock.map(r => r.id)
      
      if (ids.length === 0) {
        return res.json({ data: [], pagination: { page: 1, limit: pageSize, total: 0, totalPages: 0 } })
      }
      
      whereClause.id = { in: ids }
    }

    // Apply base filters
    whereClause.activo = activo === 'false' ? false : true
    
    if (categoriaId) {
      whereClause.categoriaId = parseInt(categoriaId)
    }

    if (busqueda) {
      whereClause.OR = [
        { nombre: { contains: busqueda, mode: 'insensitive' } },
        { codigoBarras: { contains: busqueda } },
        { codigoInterno: { contains: busqueda } }
      ]
    }

    // Get total count for pagination
    const total = await prisma.producto.count({ where: whereClause })

    // Get paginated data
    const productos = await prisma.producto.findMany({
      where: whereClause,
      include: { categoria: true, proveedor: true },
      orderBy: { nombre: 'asc' },
      skip: offset,
      take: pageSize
    })

    const totalPages = Math.ceil(total / pageSize)
    const currentPage = Math.floor(offset / pageSize) + 1

    res.json({
      data: productos,
      pagination: {
        page: currentPage,
        limit: pageSize,
        total,
        totalPages
      }
    })
  } catch (err) {
    console.error('Error fetching productos:', err)
    res.status(500).json({ error: 'Error al obtener productos' })
  }
})

// GET /api/productos/stock-bajo — productos con stock <= stockMinimo
router.get('/stock-bajo', authMiddleware, async (req, res) => {
  try {
    const productos = await prisma.$queryRaw`
      SELECT p.*, c.nombre as categoria_nombre
      FROM productos p
      LEFT JOIN categorias c ON p."categoriaId" = c.id
      WHERE p.stock <= p."stockMinimo" AND p.activo = true
      ORDER BY p.stock ASC
    `
    res.json(productos)
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener productos con stock bajo' })
  }
})

// GET /api/productos/barras/:codigo — buscar por código de barras (para el POS)
router.get('/barras/:codigo', authMiddleware, async (req, res) => {
  try {
    const producto = await prisma.producto.findUnique({
      where: { codigoBarras: req.params.codigo },
      include: { categoria: true }
    })

    if (!producto || !producto.activo) {
      return res.status(404).json({ error: 'Producto no encontrado' })
    }

    res.json(producto)
  } catch (err) {
    res.status(500).json({ error: 'Error al buscar producto' })
  }
})

// GET /api/productos/:id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const producto = await prisma.producto.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { categoria: true, proveedor: true }
    })

    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' })

    res.json(producto)
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener producto' })
  }
})

// POST /api/productos/bulk — carga masiva (solo ADMIN)
router.post('/bulk', authMiddleware, soloAdmin, async (req, res) => {
  const { productos } = req.body;

  if (!productos || !Array.isArray(productos) || productos.length === 0) {
    return res.status(400).json({ error: 'Lista de productos vacía o inválida' });
  }

  let creados = 0;
  let actualizados = 0;
  let errores = 0;

  try {
    // Usamos iteración en vez de $transaction interactiva para simplificar el flujo upsert/create manual
    // o para gestionar errores individuales sin abortar toda la transacción si un código falla.
    for (const prod of productos) {
      if (!prod.nombre || !prod.precio) {
        errores++;
        continue;
      }

      const payload = {
        nombre: prod.nombre,
        descripcion: prod.descripcion || null,
        codigoBarras: prod.codigoBarras ? String(prod.codigoBarras).trim() : null,
        precio: parseFloat(prod.precio),
        stock: parseInt(prod.stock) || 0,
        stockMinimo: parseInt(prod.stockMinimo) || 5,
        categoriaId: prod.categoriaId ? parseInt(prod.categoriaId) : null
      };

      try {
        if (payload.codigoBarras) {
          // Buscamos si existe
          const existente = await prisma.producto.findUnique({
            where: { codigoBarras: payload.codigoBarras }
          });

          if (existente) {
            // Update
            await prisma.producto.update({
              where: { id: existente.id },
              data: payload
            });
            actualizados++;
          } else {
            // Create
            await prisma.producto.create({ data: payload });
            creados++;
          }
        } else {
          // Si no tiene código de barras, siempre lo creamos
          await prisma.producto.create({ data: payload });
          creados++;
        }
      } catch (innerErr) {
        console.error('Error insertando producto individual', prod.nombre, innerErr);
        errores++;
      }
    }

    res.status(200).json({
      mensaje: 'Proceso de carga masiva finalizado',
      creados,
      actualizados,
      errores
    });

  } catch (err) {
    console.error('Error en carga masiva:', err);
    res.status(500).json({ error: 'Error al procesar la carga masiva' });
  }
})

// POST /api/productos — crear producto (solo ADMIN)
router.post('/',
  authMiddleware,
  soloAdmin,
  [
    body('nombre').notEmpty().withMessage('El nombre es requerido'),
    body('precio').isFloat({ min: 0 }).withMessage('El precio debe ser un número positivo'),
    body('codigoBarras').optional().isString(),
    body('codigoInterno').optional().isString(),
    body('stock').optional().isInt({ min: 0 }).withMessage('El stock debe ser un número entero'),
    body('stockMinimo').optional().isInt({ min: 0 }).withMessage('El stock mínimo debe ser un número entero'),
    body('precioCompra').optional().isFloat({ min: 0 }).withMessage('El precio de compra debe ser un número positivo'),
    body('categoriaId').optional().isInt().withMessage('El ID de categoría debe ser un número'),
    body('proveedorId').optional().isInt().withMessage('El ID de proveedor debe ser un número')
  ],
  validate,
  async (req, res) => {
    const {
      nombre, descripcion, codigoBarras, codigoInterno,
      precio, precioCompra, stock, stockMinimo,
      unidadMedida, categoriaId, proveedorId, imagen
    } = req.body

    try {
    const producto = await prisma.producto.create({
      data: {
        nombre,
        descripcion,
        codigoBarras,
        codigoInterno,
        precio: parseFloat(precio),
        precioCompra: precioCompra ? parseFloat(precioCompra) : null,
        stock: parseInt(stock) || 0,
        stockMinimo: parseInt(stockMinimo) || 5,
        unidadMedida: unidadMedida || 'unidad',
        categoriaId: categoriaId ? parseInt(categoriaId) : null,
        proveedorId: proveedorId ? parseInt(proveedorId) : null,
        imagen
      },
      include: { categoria: true }
    })
    res.status(201).json(producto)
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(400).json({ error: 'El código de barras o interno ya existe' })
    }
    res.status(500).json({ error: 'Error al crear producto' })
  }
})

// PUT /api/productos/:id — actualizar producto (solo ADMIN)
router.put('/:id',
  authMiddleware,
  soloAdmin,
  [
    param('id').isInt().withMessage('El ID debe ser un número entero'),
    body('nombre').optional().notEmpty().withMessage('El nombre no puede estar vacío'),
    body('precio').optional().isFloat({ min: 0 }).withMessage('El precio debe ser un número positivo'),
    body('codigoBarras').optional().isString(),
    body('codigoInterno').optional().isString(),
    body('stock').optional().isInt({ min: 0 }).withMessage('El stock debe ser un número entero'),
    body('stockMinimo').optional().isInt({ min: 0 }).withMessage('El stock mínimo debe ser un número entero'),
    body('precioCompra').optional().isFloat({ min: 0 }).withMessage('El precio de compra debe ser un número positivo'),
    body('categoriaId').optional().isInt().withMessage('El ID de categoría debe ser un número'),
    body('proveedorId').optional().isInt().withMessage('El ID de proveedor debe ser un número')
  ],
  validate,
  async (req, res) => {
    const {
      nombre, descripcion, codigoBarras, codigoInterno,
      precio, precioCompra, stock, stockMinimo,
      unidadMedida, categoriaId, proveedorId, activo, imagen
    } = req.body

    try {
    const producto = await prisma.producto.update({
      where: { id: parseInt(req.params.id) },
      data: {
        ...(nombre && { nombre }),
        ...(descripcion !== undefined && { descripcion }),
        ...(codigoBarras !== undefined && { codigoBarras }),
        ...(codigoInterno !== undefined && { codigoInterno }),
        ...(precio && { precio: parseFloat(precio) }),
        ...(precioCompra !== undefined && { precioCompra: precioCompra ? parseFloat(precioCompra) : null }),
        ...(stock !== undefined && { stock: parseInt(stock) }),
        ...(stockMinimo !== undefined && { stockMinimo: parseInt(stockMinimo) }),
        ...(unidadMedida && { unidadMedida }),
        ...(categoriaId !== undefined && { categoriaId: categoriaId ? parseInt(categoriaId) : null }),
        ...(proveedorId !== undefined && { proveedorId: proveedorId ? parseInt(proveedorId) : null }),
        ...(activo !== undefined && { activo }),
        ...(imagen !== undefined && { imagen })
      },
      include: { categoria: true }
    })
    res.json(producto)
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Producto no encontrado' })
    res.status(500).json({ error: 'Error al actualizar producto' })
  }
})

// DELETE /api/productos/:id — baja lógica (solo ADMIN)
router.delete('/:id', authMiddleware, soloAdmin, async (req, res) => {
  try {
    await prisma.producto.update({
      where: { id: parseInt(req.params.id) },
      data: { activo: false }
    })
    res.json({ mensaje: 'Producto dado de baja correctamente' })
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Producto no encontrado' })
    res.status(500).json({ error: 'Error al dar de baja el producto' })
  }
})

module.exports = router
