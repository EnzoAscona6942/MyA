const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed de MyA...')

  // Usuario Admin
  const hash = await bcrypt.hash('admin123', 10)
  const admin = await prisma.usuario.upsert({
    where: { email: 'admin@mya.com' },
    update: {},
    create: {
      nombre: 'Administrador',
      email: 'admin@mya.com',
      password: hash,
      rol: 'ADMIN'
    }
  })
  console.log(`✅ Usuario admin creado: ${admin.email}`)

  // Categorías básicas
  const categorias = ['Almacén', 'Bebidas', 'Lácteos', 'Carnes', 'Verdulería', 'Limpieza', 'Perfumería']
  for (const nombre of categorias) {
    await prisma.categoria.upsert({
      where: { nombre },
      update: {},
      create: { nombre }
    })
  }
  console.log(`✅ Categorías creadas: ${categorias.join(', ')}`)

  // Productos de ejemplo
  const almacen = await prisma.categoria.findUnique({ where: { nombre: 'Almacén' } })
  const bebidas = await prisma.categoria.findUnique({ where: { nombre: 'Bebidas' } })

  await prisma.producto.createMany({
    skipDuplicates: true,
    data: [
      {
        nombre: 'Arroz Largo Fino 1kg',
        codigoBarras: '7790070000001',
        precio: 850,
        precioCompra: 600,
        stock: 50,
        stockMinimo: 10,
        categoriaId: almacen.id
      },
      {
        nombre: 'Aceite Girasol 1.5L',
        codigoBarras: '7790070000002',
        precio: 1200,
        precioCompra: 900,
        stock: 30,
        stockMinimo: 8,
        categoriaId: almacen.id
      },
      {
        nombre: 'Coca-Cola 2.25L',
        codigoBarras: '7790070000003',
        precio: 950,
        precioCompra: 700,
        stock: 24,
        stockMinimo: 6,
        categoriaId: bebidas.id
      },
      {
        nombre: 'Agua Mineral 500ml',
        codigoBarras: '7790070000004',
        precio: 350,
        precioCompra: 200,
        stock: 48,
        stockMinimo: 12,
        categoriaId: bebidas.id
      }
    ]
  })
  console.log('✅ Productos de ejemplo creados')

  console.log('\n🎉 Seed completado!')
  console.log('─────────────────────────────────')
  console.log('📧 Email:    admin@mya.com')
  console.log('🔑 Password: admin123')
  console.log('─────────────────────────────────')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
