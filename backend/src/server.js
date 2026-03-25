require('dotenv').config()
const express = require('express')
const cors = require('cors')

// Rutas
const authRoutes = require('./routes/auth')
const usuariosRoutes = require('./routes/usuarios')
const productosRoutes = require('./routes/productos')
const ventasRoutes = require('./routes/ventas')
const cajaRoutes = require('./routes/caja')
const reportesRoutes = require('./routes/reportes')
const catalogosRoutes = require('./routes/catalogos')
const stockRoutes = require('./routes/stock')
const auditRoutes = require('./routes/audit')

// Middlewares
const { authLimiter, ventasLimiter, apiLimiter } = require('./middlewares/rateLimiter')
const { auditMiddleware } = require('./middlewares/audit')

const app = express()
const PORT = process.env.PORT || 3001

// ── Middlewares globales ─────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}))
app.use(express.json())

// ── Audit logging (non-blocking) ──────────────────────────────
app.use(auditMiddleware)

// ── Rutas con rate limiting ─────────────────────────────────
// Auth routes: stricter limit (5 req/min) - brute force protection
app.use('/api/auth', authLimiter, authRoutes)
// Ventas/POS routes: 100 req/min limit
app.use('/api/ventas', ventasLimiter, ventasRoutes)
// API routes with general limit
app.use('/api/productos', apiLimiter, productosRoutes)
app.use('/api/caja', apiLimiter, cajaRoutes)
app.use('/api/reportes', apiLimiter, reportesRoutes)
app.use('/api', catalogosRoutes)       // /api/categorias y /api/proveedores
app.use('/api/stock', apiLimiter, stockRoutes)
// Audit route: solo admins
app.use('/api/audit', auditRoutes)
// Usuarios route: solo admins
app.use('/api/usuarios', apiLimiter, usuariosRoutes)

// ── Health check ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', proyecto: 'MyA Minimercado', version: '1.0.0' })
})

// ── 404 ──────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Ruta ${req.method} ${req.path} no encontrada` })
})

// ── Error handler global ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Error interno del servidor' })
})

// Only start server if this file is run directly (not required as module)
// This allows tests to import app without starting the server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`✅ MyA Backend corriendo en http://localhost:${PORT}`)
    console.log(`📋 Health check: http://localhost:${PORT}/api/health`)
  })
}

module.exports = app
