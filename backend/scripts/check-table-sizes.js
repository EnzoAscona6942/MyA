/**
 * Tamanio real de cada tabla. Sirve para interpretar los planes de ejecucion:
 * un indice sobre una tabla de 11 filas no lo va a elegir el optimizador, y
 * no es un problema.
 *
 * Se ejecuta con: node scripts/check-table-sizes.js
 */
require('dotenv').config();
const prisma = require('../src/lib/prisma');

(async () => {
  const tablas = await prisma.$queryRawUnsafe(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`
  );

  console.log('\n' + 'tabla'.padEnd(26) + 'filas'.padEnd(12) + 'tamano');
  console.log('-'.repeat(60));
  for (const { tablename } of tablas) {
    // COUNT(*) exacto: n_live_tup es una estimacion y devuelve 0 hasta que
    // el colector de estadisticas corre, lo que hace inutil el dato.
    const c = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM "${tablename}"`);
    const s = await prisma.$queryRawUnsafe(
      `SELECT pg_size_pretty(pg_total_relation_size('"${tablename}"')) AS s`
    );
    console.log(tablename.padEnd(26) + String(c[0].n).padEnd(12) + s[0].s);
  }
  await prisma.$disconnect();
})().catch(async (e) => { console.error('ERROR: ' + e.message); await prisma.$disconnect(); process.exit(1); });