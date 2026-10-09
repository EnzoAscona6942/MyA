// Export all services
const authService = require('./auth.service')
const ventaService = require('./venta.service')
const stockService = require('./stock.service')
const cajaService = require('./caja.service')
const productosService = require('./productos.service')

module.exports = {
  auth: authService,
  venta: ventaService,
  stock: stockService,
  caja: cajaService,
  productos: productosService
}