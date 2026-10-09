// ============================================================
// PRODUCTOS SERVICE — OPEN FOOD FACTS LOOKUP
// ============================================================
//
// Owns the whole upstream contract for barcode name resolution:
// normalization, caching and graceful degradation.
//
// Degradation decision: EVERY transport-level failure (network error, timeout,
// unparseable body, upstream 5xx) degrades to `{ found: false }` instead of
// propagating. The route therefore never has to translate an upstream outage
// into an error the operator would have to handle: a barcode that cannot be
// resolved simply behaves like a barcode Open Food Facts does not know, which
// is the single most common real case (bakery, bulk goods, local products).
// A consequence worth knowing: there is no meaningful "503 upstream" to signal,
// so the route keeps a 503 branch purely as a defensive net.
//
// Caching decision: only real answers from Open Food Facts (a resolved product
// OR a definitive "unknown product") are cached. Transport failures are NOT
// cached, otherwise a 30 second network blip would poison the entry for 24h.
// ============================================================

const DEFAULT_BASE_URL = 'https://world.openfoodfacts.org/api/v2/product'
const REQUEST_TIMEOUT_MS = 5000
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const CACHE_MAX_ENTRIES = 500

// Open Food Facts asks every caller to identify itself so abusive clients can
// be contacted. Node 20 sends `undici` by default, which they explicitly reject.
// The contact is the public repository, which is where an operator can be
// reached about a lookup problem.
const USER_AGENT = 'MyA-Gestion/1.0 (+https://github.com/EnzoAscona6942/MyA)'

// Only the name fields are requested: the v2 `fields` selector keeps the
// payload small (the default response is hundreds of KB per product).
const REQUESTED_FIELDS = 'code,product_name,product_name_es'

/**
 * In-memory cache of upstream answers, keyed by normalized barcode.
 * `Map` preserves insertion order, which is what makes the oldest-entry
 * eviction below a simple O(1) walk from the front.
 */
const cache = new Map()

const baseUrl = () => process.env.OPENFOODFACTS_BASE_URL || DEFAULT_BASE_URL

/** Reads a cache entry, dropping it first if it outlived the TTL. */
const leerCache = (codigo) => {
  const entry = cache.get(codigo)
  if (!entry) return null

  if (Date.now() - entry.timestamp >= CACHE_TTL_MS) {
    cache.delete(codigo)
    return null
  }
  return entry.value
}

/** Stores an answer and evicts the oldest entries once the cache is full. */
const escribirCache = (codigo, value) => {
  // Delete first so a re-insert moves the key to the back of the eviction
  // queue; otherwise a hit entry would be evicted while still fresh.
  cache.delete(codigo)
  cache.set(codigo, { value, timestamp: Date.now() })

  while (cache.size > CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value
    if (oldestKey === undefined) break
    cache.delete(oldestKey)
  }
}

/**
 * Open Food Facts `v2` answers unknown barcodes with HTTP 404 and
 * `status: 0`; both are a real "I looked, I don't know it" answer.
 */
const esRespuestaDefinitiva = (res, payload) =>
  (res.status === 404 || (payload && payload.status === 0))

/** `product_name` -> `product_name_es` -> null. */
const resolverNombre = (product) => {
  if (!product || typeof product !== 'object') return null

  const candidatos = [product.product_name, product.product_name_es]
  for (const candidato of candidatos) {
    if (typeof candidato === 'string' && candidato.trim() !== '') {
      return candidato.trim()
    }
  }
  return null
}

/**
 * Looks a barcode up on Open Food Facts and resolves the product name.
 *
 * Always resolves — never rejects — with the shape
 * `{ codigoBarras: string, found: boolean, nombre: string | null }`.
 *
 * @param {string} codigoBarras Raw barcode as typed by the operator; any
 *   non-digit character is discarded before the lookup.
 * @returns {Promise<{codigoBarras: string, found: boolean, nombre: string|null}>}
 */
async function consultarOpenFoodFacts(codigoBarras) {
  const codigo = String(codigoBarras ?? '').replace(/\D/g, '')
  const noEncontrado = { codigoBarras: codigo, found: false, nombre: null }

  // Defence in depth: the route already rejects malformed barcodes with a 400,
  // so an invalid code here means a caller that bypassed the border. Not
  // sending it upstream is what keeps the endpoint off the network.
  if (codigo === '') return noEncontrado

  const cached = leerCache(codigo)
  if (cached) return cached

  const url = `${baseUrl()}/${codigo}.json?fields=${REQUESTED_FIELDS}`

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })

    const payload = await res.json().catch(() => null)

    if (res.ok) {
      const nombre = resolverNombre(payload && payload.product)
      const resultado = { codigoBarras: codigo, found: nombre !== null, nombre }
      escribirCache(codigo, resultado)
      return resultado
    }

    // A definitive "unknown barcode" is worth remembering for 24h.
    if (esRespuestaDefinitiva(res, payload)) {
      escribirCache(codigo, noEncontrado)
      return noEncontrado
    }

    console.warn(
      `[openfoodfacts] ${codigo}: upstream respondió ${res.status}, se degrada a "no encontrado"`
    )
    return noEncontrado
  } catch (err) {
    console.warn(`[openfoodfacts] ${codigo}: consulta fallida, se degrada a "no encontrado"`, err)
    return noEncontrado
  }
}

/** Clears the in-memory cache. Exposed for tests and manual invalidation. */
function resetCache() {
  cache.clear()
}

/** Current number of cached entries. Exposed for tests. */
function cacheSize() {
  return cache.size
}

module.exports = {
  consultarOpenFoodFacts,
  resetCache,
  cacheSize,
  CACHE_MAX_ENTRIES,
  CACHE_TTL_MS,
  REQUEST_TIMEOUT_MS,
  USER_AGENT
}