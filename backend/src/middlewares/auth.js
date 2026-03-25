const jwt = require('jsonwebtoken')

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Token requerido' })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.usuario = decoded
    next()
  } catch (err) {
    return res.status(403).json({ error: 'Token inválido o expirado' })
  }
}

const soloAdmin = (req, res, next) => {
  if (req.usuario.rol !== 'ADMIN') {
    return res.status(403).json({ error: 'Acceso solo para administradores' })
  }
  next()
}

module.exports = { authMiddleware, soloAdmin }
