const prisma = require('../src/lib/prisma')

describe('Debug Prisma Mock', () => {
  test('prisma should have producto model', () => {
    console.log('prisma:', Object.keys(prisma))
    console.log('prisma.producto:', prisma.producto)
    console.log('prisma.caja:', prisma.caja)
    console.log('prisma.venta:', prisma.venta)
    
    expect(prisma).toBeDefined()
    expect(prisma.producto).toBeDefined()
    expect(prisma.producto.findMany).toBeDefined()
  })
})