/**
 * Verificacion end-to-end sin levantar servidor:
 *   1. El schema real de backend/src/schemas con query params tipo Express (strings).
 *   2. Una query real de Prisma contra la base, usando los valores ya parseados.
 * Sale con codigo != 0 si algo falla.
 */
require('dotenv').config();
const path = require('path');
process.chdir(path.join(__dirname, '..'));

const { ZodError } = require('zod');
const z = require('zod');
const { paginationSchema, busquedaSchema } = require('../src/schemas');
const { validateQuery } = require('../src/middlewares/validate');

let fallos = 0;
const ok = (c, m) => { console.log((c ? '  OK   ' : '  FALLA') + '  ' + m); if (!c) fallos++; };

// El mismo schema que usa la ruta GET /api/ventas
const ventasQuery = paginationSchema.merge(busquedaSchema).extend({
  cajaId: z.coerce.number().int().positive().optional(),
  estado: z.enum(['COMPLETADA', 'ANULADA', 'PENDIENTE']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional()
});

console.log('\n[1] validateQuery con query params reales de Express (siempre strings)');

// validateQuery(schema) devuelve el middleware. El exito llama next(), el
// fallo escribe en res. Hacemos un res falso que registre lo que recibe.
const ventasMiddleware = validateQuery(ventasQuery);

const runValidate = (middleware, query) => {
  const res = { statusCode: undefined, body: undefined };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (b) => { res.body = b; return res; };
  let nextCalled = false;
  middleware({ query }, res, () => { nextCalled = true; });
  return { ...res, nextCalled };
};

const casos = [
  ['sin params', {}],
  ['skip/take string  (el bug que daba 400)', { skip: '0', take: '20' }],
  ['skip alto', { skip: '40', take: '10' }],
  ['busqueda + cajaId + fechas', { skip: '0', take: '5', busqueda: 'a', cajaId: '1', from: '2020-01-01T00:00:00.000Z', to: '2030-01-01T00:00:00.000Z' }]
];
for (const [nombre, input] of casos) {
  const r = runValidate(ventasMiddleware, input);
  ok(r.nextCalled, nombre.padEnd(42) + '-> pasa');
  if (!r.nextCalled) console.log('        HTTP ' + r.statusCode + ' ' + JSON.stringify(r.body));
}

console.log('\n[2] el schema sigue rechazando lo invalido');
for (const [nombre, input] of [
  ['skip negativo', { skip: '-1' }],
  ['take 0', { take: '0' }],
  ['cajaId no numerico', { cajaId: 'abc' }],
  ['from sin hora', { from: '2026-10-01' }]
]) {
  const r = ventasQuery.safeParse(input);
  ok(!r.success, nombre.padEnd(42) + '-> rechazado');
}

(async () => {
  console.log('\n[3] query real de Prisma con los valores ya parseados');
  const prisma = require('../src/lib/prisma');
  // El middleware reemplaza req.query con los valores ya parseados, asi que
  // hay que conservar el MISMO objeto req para leerlos.
  const req = { query: { skip: '0', take: '3' } };
  const res = { statusCode: undefined, body: undefined };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  let passed = false;
  ventasMiddleware(req, res, () => { passed = true; });

  ok(passed, 'validateQuery acepto skip/take como string');
  ok(typeof req.query.skip === 'number' && typeof req.query.take === 'number',
    'req.query quedo con numeros -> skip=' + JSON.stringify(req.query.skip) + ' take=' + JSON.stringify(req.query.take));

  const total = await prisma.venta.count();
  const items = await prisma.venta.findMany({
    skip: req.query.skip,
    take: req.query.take,
    orderBy: { fecha: 'desc' }
  });
  ok(typeof total === 'number', 'conteo de ventas = ' + total);
  ok(items.length === 3, 'findMany respeto take=3 -> devolvio ' + items.length + ' filas');

  const cats = await prisma.categoria.count();
  const prods = await prisma.producto.count();
  const users = await prisma.usuario.count();
  console.log('        categorias=' + cats + ' productos=' + prods + ' usuarios=' + users);

  // El reporte que usa la pagina Reportes
  const bajo = await prisma.$queryRawUnsafe(
    'SELECT COUNT(*)::int as cantidad FROM productos WHERE stock <= "stockMinimo" AND stock > 0 AND activo = true'
  );
  ok(Array.isArray(bajo) && typeof bajo[0].cantidad === 'number',
    'reportes/stock stockBajo es numero = ' + bajo[0].cantidad);

  await prisma.$disconnect();
  console.log('\n' + (fallos === 0 ? 'TODAS LAS COMPROBACIONES PASARON' : fallos + ' COMPROBACIONES FALLARON'));
  process.exit(fallos === 0 ? 0 : 1);
})().catch((e) => { console.error('\nERROR: ' + e.message); process.exit(1); });