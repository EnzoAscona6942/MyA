// ============================================================
// CAJA SERVICE — LÓGICA DE NEGOCIO DE CAJA
// ============================================================

const prisma = require('../lib/prisma')
const { cajaAbrirSchema, cajaCloseSchema, movimientoCajaSchema } = require('../schemas')

/**
 * Abrir nueva caja
 */
const abrirCaja = async ({ montoInicial, usuarioId, observaciones }) => {
  // 1. Validar esquema
  const validated = cajaAbrirSchema.parse({ montoInicial, observaciones })

  // 2. Verificar que no haya otra caja abierta
  const cajaAbierta = await prisma.caja.findFirst({ where: { estado: 'ABIERTA' } })
  if (cajaAbierta) {
    throw new Error('Ya hay una caja abierta. Cerrala antes de abrir una nueva.')
  }

  // 3. Crear caja
  const caja = await prisma.caja.create({
    data: {
      montoInicial: parseFloat(validated.montoInicial),
      usuarioId: Number(usuarioId),
      observaciones: validated.observaciones
    },
    include: { usuario: { select: { nombre: true } } }
  })

  return caja
}

/**
 * Obtener caja activa
 */
const obtenerCajaActiva = async () => {
  const caja = await prisma.caja.findFirst({
    where: { estado: 'ABIERTA' },
    include: {
      usuario: { select: { nombre: true } },
      movimientos: true
    }
  })

  if (!caja) return null

  // Calcular totales de ventas de la caja activa
  const resumen = await prisma.venta.aggregate({
    where: { cajaId: caja.id, estado: 'COMPLETADA' },
    _sum: { total: true },
    _count: { id: true }
  })

  return {
    ...caja,
    totalVentas: resumen._sum.total || 0,
    cantidadVentas: resumen._count.id
  }
}

/**
 * Cerrar caja con resumen completo
 */
const cerrarCaja = async ({ cajaId, montoFinalReal, observaciones }) => {
  // 1. Validar
  const validated = cajaCloseSchema.parse({ montoFinalReal, observaciones })
  const id = Number(cajaId)

  // 2. Obtener caja
  const caja = await prisma.caja.findUnique({ where: { id } })
  if (!caja) throw new Error('Caja no encontrada')
  if (caja.estado === 'CERRADA') throw new Error('La caja ya está cerrada')

  // 3. Calcular resumen de ventas por método de pago
  const ventasPorMetodo = await prisma.venta.groupBy({
    by: ['metodoPago'],
    where: { cajaId: id, estado: 'COMPLETADA' },
    _sum: { total: true },
    _count: { id: true }
  })

  const totalVentas = ventasPorMetodo.reduce(
    (acc, v) => acc + parseFloat(v._sum.total || 0), 0
  )

  // 4. Calcular movimientos manuales
  const movimientos = await prisma.movimientoCaja.findMany({ where: { cajaId: id } })
  const totalIngresos = movimientos
    .filter(m => m.tipo === 'INGRESO')
    .reduce((acc, m) => acc + parseFloat(m.monto), 0)
  const totalEgresos = movimientos
    .filter(m => m.tipo === 'EGRESO')
    .reduce((acc, m) => acc + parseFloat(m.monto), 0)

  // 5. Calcular efectivo esperado = monto inicial + ventas en efectivo + ingresos - egresos
  const ventasEfectivo = ventasPorMetodo
    .find(v => v.metodoPago === 'EFECTIVO')?._sum?.total || 0

  const efectivoEsperado =
    parseFloat(caja.montoInicial) + parseFloat(ventasEfectivo) + totalIngresos - totalEgresos

  const diferencia = parseFloat(montoFinalReal) - efectivoEsperado

  // 6. Actualizar caja
  const cajaCerrada = await prisma.caja.update({
    where: { id },
    data: {
      estado: 'CERRADA',
      fechaCierre: new Date(),
      montoFinalReal: parseFloat(montoFinalReal),
      observaciones
    }
  })

  return {
    caja: cajaCerrada,
    resumen: {
      montoInicial: caja.montoInicial,
      totalVentas,
      ventasPorMetodo,
      totalIngresos,
      totalEgresos,
      efectivoEsperado,
      montoFinalReal: parseFloat(montoFinalReal),
      diferencia
    }
  }
}

/**
 * Registrar movimiento manual (ingreso/egreso)
 */
const registrarMovimiento = async ({ cajaId, tipo, monto, descripcion }) => {
  // 1. Validar
  const validated = movimientoCajaSchema.parse({ tipo, monto, descripcion })
  const id = Number(cajaId)

  // 2. Verificar caja abierta
  const caja = await prisma.caja.findUnique({ where: { id } })
  if (!caja || caja.estado !== 'ABIERTA') {
    throw new Error('No hay caja abierta con ese ID')
  }

  // 3. Crear movimiento
  const movimiento = await prisma.movimientoCaja.create({
    data: {
      tipo: validated.tipo,
      monto: parseFloat(validated.monto),
      descripcion: validated.descripcion,
      cajaId: id
    }
  })

  return movimiento
}

/**
 * Historial de cajas
 */
const historialCajas = async ({ desde, hasta, skip = 0, take = 20 }) => {
  const whereClause = {}

  if (desde || hasta) {
    whereClause.fechaApertura = {}
    if (desde) whereClause.fechaApertura.gte = new Date(desde)
    if (hasta) whereClause.fechaApertura.lte = new Date(hasta)
  }

  const cajas = await prisma.caja.findMany({
    where: whereClause,
    include: { usuario: { select: { nombre: true } } },
    orderBy: { fechaApertura: 'desc' },
    skip,
    take
  })

  return cajas
}

module.exports = {
  abrirCaja,
  obtenerCajaActiva,
  cerrarCaja,
  registrarMovimiento,
  historialCajas
}