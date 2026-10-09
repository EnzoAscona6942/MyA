/**
 * Consulta de solo lectura: que indices existen REALMENTE en la base,
 * comparado con lo que schema.prisma declara.
 *
 * No intenta adivinar el nombre de la tabla a partir del nombre del modelo:
 * Prisma pluraliza y puede renombrar con @@map, asi que una conversion por
 * string daba falsos negativos. Se resuelve leyendo el indexdef real de
 * Postgres y comparando las columnas.
 *
 * Se ejecuta con: node scripts/check-indexes.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const prisma = require('../src/lib/prisma');

const schema = fs.readFileSync(path.join(__dirname, '..', 'prisma', 'schema.prisma'), 'utf8');

/** Indices declarados por modelo, en el formato @@index([a, b]) */
function declaradosPorModelo() {
  const out = {};
  let modelo = null;
  for (const linea of schema.split('\n')) {
    const m = linea.match(/^model\s+(\w+)\s*\{/);
    if (m) { modelo = m[1]; continue; }
    const idx = linea.match(/@@index\(\[([^\]]+)\]\)/);
    if (idx && modelo) (out[modelo] ||= []).push(idx[1].split(',').map((c) => c.trim()));
    if (linea.trim() === '}' && modelo) modelo = null;
  }
  return out;
}

/** El @@map del modelo, si existe; si no, Prisma usa el nombre en minusculas pluralizado. */
function tablaDeModelo(modelo, tablasReales) {
  const bloque = schema.match(new RegExp(`model\\s+${modelo}\\s*\\{[\\s\\S]*?\\n\\}`));
  const map = bloque && bloque[0].match(/@@map\("([^"]+)"\)/);
  if (map) return map[1];
  const candidatos = [
    modelo.toLowerCase(),
    modelo.toLowerCase() + 's',
    modelo.toLowerCase() + 'es'
  ];
  return candidatos.find((c) => tablasReales.has(c)) || candidatos[0];
}

/** Columnas que cubre un indice, segun su definicion real en Postgres. */
function columnasDe(indexdef) {
  const m = indexdef.match(/\(([^)]*)\)\s*WHERE/i) || indexdef.match(/\(([^)]*)\)/);
  if (!m) return null;
  return m[1].split(',').map((c) => c.trim().replace(/^"|"$/g, '').split(/\s+/)[0]);
}

(async () => {
  const tablas = await prisma.$queryRawUnsafe(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`
  );
  const tablasReales = new Set(tablas.map((t) => t.tablename));

  const declarados = declaradosPorModelo();

  console.log('\n=== Indices REALES en la base (con sus columnas) ===');
  const porTabla = {};
  for (const t of tablasReales) porTabla[t] = [];
  const idx = await prisma.$queryRawUnsafe(
    `SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname='public'`
  );
  for (const r of idx) {
    if (porTabla[r.tablename]) porTabla[r.tablename].push({ nombre: r.indexname, cols: columnasDe(r.indexdef) });
  }
  for (const t of ['ventas', 'productos', 'cajas', 'movimientos_caja', 'ingresos_stock', 'venta_items', 'audit_logs']) {
    console.log(`\n${t}:`);
    const lista = porTabla[t] || [];
    if (lista.length === 0) { console.log('   (solo la clave primaria o nada)'); continue; }
    for (const i of lista) console.log(`   ${i.nombre}  [${(i.cols || []).join(', ')}]`);
  }

  console.log('\n\n=== Declarado en schema.prisma  ->  existe en la base? ===');
  let ok = 0;
  const faltan = [];
  for (const [modelo, listas] of Object.entries(declarados)) {
    const tabla = tablaDeModelo(modelo, tablasReales);
    const reales = porTabla[tabla] || [];
    for (const cols of listas) {
      const coincide = reales.some((r) => {
        if (!r.cols || r.cols.length !== cols.length) return false;
        return cols.every((c, i) => c.toLowerCase() === r.cols[i].toLowerCase());
      });
      if (coincide) { ok++; console.log(`   ok      ${tabla}  [${cols.join(', ')}]`); }
      else { faltan.push(`${tabla}  [${cols.join(', ')}]`); console.log(`   FALTA   ${tabla}  [${cols.join(', ')}]`); }
    }
  }
  console.log(`\nresueltos en la base: ${ok}   ausentes: ${faltan.length}`);

  console.log('\nfilas reales:');
  for (const t of ['productos', 'ventas', 'cajas', 'ingresos_stock']) {
    const r = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM "${t}"`);
    console.log(`   ${t}: ${r[0].n}`);
  }

  await prisma.$disconnect();
})().catch(async (e) => { console.error('ERROR: ' + e.message); await prisma.$disconnect(); process.exit(1); });