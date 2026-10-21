// Búsqueda de texto tolerante: sin tildes ni mayúsculas, palabra a palabra (cualquier orden),
// por prefijo / trozo y con erratas (distancia de edición). Devuelve una puntuación para ordenar.

export const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

export const words = (s: string) => norm(s).split(' ').filter(Boolean)

/** Distancia de Levenshtein con corte temprano */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let best = i
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      best = Math.min(best, cur[j])
    }
    if (best > max) return max + 1
    prev = cur
  }
  return prev[b.length]
}

/** Erratas permitidas según la longitud de la palabra buscada */
const allowedTypos = (len: number) => (len >= 8 ? 2 : len >= 5 ? 1 : 0)

/** Puntuación de una palabra buscada frente a las palabras del texto (0 = no coincide) */
export function tokenScore(q: string, hay: string[]): number {
  let best = 0
  const typos = allowedTypos(q.length)
  for (const w of hay) {
    if (w === q) return 3
    if (w.startsWith(q)) best = Math.max(best, 2.5)
    else if (q.length >= 3 && w.includes(q)) best = Math.max(best, 1.8)
    else if (typos) {
      // errata en la palabra entera o en su comienzo ("gaspacho" ~ "gazpacho", "sentadila" ~ "sentadillas")
      const d = Math.min(editDistance(q, w, typos), editDistance(q, w.slice(0, q.length), typos))
      if (d <= typos) best = Math.max(best, 1.2 - d * 0.2)
    }
  }
  return best
}

/**
 * Puntuación de una búsqueda (lista de grupos de alternativas por palabra) frente a un texto.
 * Todas las palabras deben coincidir con alguna alternativa; null si alguna no coincide.
 */
export function matchScore(query: string[][], text: string, bonusText?: string): number | null {
  if (!query.length) return 0
  const hay = words(text)
  const bonusHay = bonusText != null ? words(bonusText) : null
  let total = 0
  // la primera alternativa es la palabra escrita: pesa algo más que sus sinónimos o traducciones
  const best = (alts: string[], h: string[]) => Math.max(...alts.map((a, i) => tokenScore(a, h) * (i === 0 ? 1.15 : 1)))
  for (const alts of query) {
    const s = best(alts, hay)
    if (s === 0) return null
    total += s
    // coincidencias en el campo principal (p. ej. el nombre) puntúan más
    if (bonusHay) total += best(alts, bonusHay) * 0.5
  }
  return total
}

/** Palabras vacías en español que no aportan a la búsqueda ("remo con barra" → remo barra) */
const STOPWORDS = new Set(['de', 'del', 'con', 'al', 'a', 'el', 'la', 'los', 'las', 'en', 'y', 'para', 'por', 'sin', 'un', 'una'])
/** Quita palabras vacías salvo que la búsqueda solo tenga esas */
export function dropStopwords(ws: string[]): string[] {
  const kept = ws.filter((w) => !STOPWORDS.has(w))
  return kept.length ? kept : ws
}

/** Consulta simple: cada palabra es su propia alternativa */
export const simpleQuery = (q: string) => dropStopwords(words(q)).map((w) => [w])

/** Filtra y ordena una lista por relevancia (mantiene el orden original si no hay búsqueda) */
export function fuzzyFilter<T>(list: T[], q: string, text: (x: T) => string, main?: (x: T) => string): T[] {
  const query = simpleQuery(q)
  if (!query.length) return list
  return list
    .map((x, i) => ({ x, i, s: matchScore(query, text(x), main?.(x)) }))
    .filter((r) => r.s != null)
    .sort((a, b) => b.s! - a.s! || a.i - b.i)
    .map((r) => r.x)
}
