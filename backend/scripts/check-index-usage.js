/**
 * Comprueba que los indices no solo existan sino que Postgres los use.
 * Compara el plan de ejecucion con y sin ellos, sobre las consultas que
 * usan las paginas de Ventas, Stock y Reportes.
 *
 * Se ejecuta con: node scripts/check-index-usage.js
 */
require('dotenv').config();
const prisma = require('../src/lib/prisma');

const CONSULTAS = [
  { nombre: 'Ventas: historial por caja y estado', sql: `SELECT * FROM ventas WHERE "cajaId" = 1 AND estado = 'COMPLETADA' ORDER BY fecha DESC` },
  { nombre: 'Ventas: rango de fechas (reportes)', sql: `SELECT * FROM ventas WHERE fecha >= '2020-01-01' AND estado = 'COMPLETADA' ORDER BY fecha` },
  { nombre: 'Stock: solo stock bajo', sql: `SELECT * FROM productos WHERE activo = true AND stock <= "stockMinimo"` },
  { nombre: 'Stock: filtro por categoria', sql: `SELECT * FROM productos WHERE activo = true AND "categoriaId" = 1` },
  { nombre: 'Reportes: ingresos por fecha', sql: `SELECT * FROM ingresos_stock WHERE fecha >= '2020-01-01' ORDER BY fecha` },
  { nombre: 'Caja: historial de una caja', sql: `SELECT * FROM movimientos_caja WHERE "cajaId" = 1 AND tipo = 'INGRESO'` },
];

async function plan(sql, usarIndices) {
  await prisma.$executeRawUnsafe(`SET enable_indexscan = ${usarIndices ? 'on' : 'off'}`);
  await prisma.$executeRawUnsafe(`SET enable_bitmapscan = ${usarIndices ? 'on' : 'off'}`);
  return prisma.$queryRawUnsafe(`EXPLAIN ${sql}`);
}

(async () => {
  for (const c of CONSULTAS) {
    const conIdx = await plan(c.sql, true);
    const sinIdx = await plan(c.sql, false);

    const usaIdx = conIdx.some((l) => /Index Scan|Bitmap Index Scan/.test(l['QUERY PLAN']));
    const usaSeq = sinIdx.some((l) => /Seq Scan/.test(l['QUERY PLAN']));

    const idx = conIdx.find((l) => /Index Scan|Bitmap Index Scan/.test(l['QUERY PLAN']));
    const nombreIdx = idx ? (idx['QUERY PLAN'].match(/using (\S+)/) || [])[1] || '' : '';

    console.log(`\n${c.nombre}`);
    console.log(`   con indices -> ${usaIdx ? 'Index Scan' : 'Seq Scan'} ${nombreIdx}`);
    console.log(`   sin indices -> ${usaSeq ? 'Seq Scan (forzado)' : 'Index Scan'}`);
    if (!usaIdx) console.log('   [!] el optimizador NO eligio el indice');
  }

  await prisma.$executeRawUnsafe('SET enable_indexscan = on');
  await prisma.$executeRawUnsafe('SET enable_bitmapscan = on');
  await prisma.$disconnect();
})().catch(async (e) => { console.error('ERROR: ' + e.message); await prisma.$disconnect(); process.exit(1); });