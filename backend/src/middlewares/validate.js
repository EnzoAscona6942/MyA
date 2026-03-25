const { body, param, query, validationResult } = require('express-validator')

/**
 * Validation rules for Productos
 */
const productoValidation = {
  create: [
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
  update: [
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
  ]
}

/**
 * Validation rules for Ventas
 */
const ventaValidation = {
  create: [
    body('cajaId').isInt().withMessage('El ID de caja es requerido'),
    body('items').isArray({ min: 1 }).withMessage('Los items de la venta son requeridos'),
    body('metodoPago').optional().isIn(['EFECTIVO', 'TARJETA_DEBITO', 'TARJETA_CREDITO', 'TRANSFERENCIA', 'QR']).withMessage('Método de pago inválido'),
    body('montoRecibido').optional().isFloat({ min: 0 }).withMessage('El monto recibido debe ser un número positivo')
  ]
}

/**
 * Validation rules for Usuarios
 */
const usuarioValidation = {
  create: [
    body('nombre').notEmpty().withMessage('El nombre es requerido'),
    body('email').isEmail().withMessage('El email debe ser válido'),
    body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
    body('rol').optional().isIn(['ADMIN', 'CAJERO']).withMessage('El rol debe ser ADMIN o CAJERO')
  ],
  update: [
    param('id').isInt().withMessage('El ID debe ser un número entero'),
    body('nombre').optional().notEmpty().withMessage('El nombre no puede estar vacío'),
    body('email').optional().isEmail().withMessage('El email debe ser válido'),
    body('password').optional().isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
    body('rol').optional().isIn(['ADMIN', 'CAJERO']).withMessage('El rol debe ser ADMIN o CAJERO'),
    body('activo').optional().isBoolean().withMessage('El campo activo debe ser un booleano')
  ]
}

/**
 * Middleware to check validation results
 */
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

module.exports = {
  productoValidation,
  ventaValidation,
  usuarioValidation,
  validate
}
