// Búsqueda de ejercicios en español sobre un catálogo con nombres en inglés.
// La consulta se traduce palabra a palabra con sinónimos y se busca en nombre, músculos y material.
import { EQUIPMENT_ES, MUSCLES } from './muscles'
import { dropStopwords, editDistance, matchScore, norm, words } from './search'
import type { Exercise } from './types'

/** Frases de varias palabras (se sustituyen antes de separar palabras) */
const PHRASES: [string, string][] = [
  ['peso muerto', 'deadlift'],
  ['press banca', 'bench press'],
  ['press de banca', 'bench press'],
  ['press militar', 'military press'],
  ['pesa rusa', 'kettlebell'],
  ['elevaciones laterales', 'lateral raise'],
  ['elevacion lateral', 'lateral raise'],
  ['sentadilla bulgara', 'split squat'],
  ['sentadilla goblet', 'goblet squat'],
  ['sentadilla copa', 'goblet squat'],
  ['jalon al pecho', 'pulldown'],
  ['curl femoral', 'leg curl'],
  ['extension de cuadriceps', 'leg extension'],
  ['prensa de piernas', 'leg press'],
  ['agarre cerrado', 'close grip'],
  ['agarre ancho', 'wide grip'],
  ['rueda abdominal', 'ab roller'],
  ['saltar a la comba', 'rope jumping'],
]

/** Palabra en español → alternativas en inglés (además de la propia palabra) */
const WORDS: Record<string, string[]> = {
  sentadilla: ['squat'], sentadillas: ['squat'],
  banca: ['bench'], banco: ['bench'],
  remo: ['row', 'rowing'],
  dominada: ['pullup', 'pullups', 'chin'], dominadas: ['pullup', 'pullups', 'chin'],
  zancada: ['lunge'], zancadas: ['lunge'],
  jalon: ['pulldown'],
  mancuerna: ['dumbbell'], mancuernas: ['dumbbell'],
  barra: ['barbell', 'bar'],
  polea: ['cable'], poleas: ['cable'],
  maquina: ['machine'],
  elevacion: ['raise'], elevaciones: ['raise'],
  lateral: ['lateral', 'side'], laterales: ['lateral', 'side'],
  frontal: ['front'], frontales: ['front'],
  fondos: ['dip', 'dips'], fondo: ['dip'],
  flexion: ['pushup', 'push'], flexiones: ['pushup', 'push'],
  plancha: ['plank'],
  abdominal: ['crunch', 'situp', 'ab'], abdominales: ['crunch', 'situp', 'ab'], encogimiento: ['shrug', 'crunch'],
  gemelo: ['calf'], gemelos: ['calf'], pantorrilla: ['calf'],
  puente: ['bridge'], empuje: ['thrust'],
  extension: ['extension'], extensiones: ['extension'],
  prensa: ['press', 'leg'],
  femoral: ['leg', 'hamstring'], femorales: ['hamstring'],
  inclinado: ['incline'], inclinada: ['incline'], declinado: ['decline'], declinada: ['decline'],
  cerrado: ['close'], ancho: ['wide'], agarre: ['grip'],
  militar: ['military', 'shoulder'],
  hombro: ['shoulder'], hombros: ['shoulder'],
  pecho: ['chest'], espalda: ['back'], pierna: ['leg'], piernas: ['leg'], brazo: ['arm'], brazos: ['arm'],
  gluteo: ['glute'], gluteos: ['glute'], cadera: ['hip'],
  aperturas: ['fly', 'flye'], apertura: ['fly', 'flye'], pajaro: ['reverse', 'rear'],
  encogimientos: ['shrug'],
  salto: ['jump'], saltos: ['jump'], comba: ['rope'], cuerda: ['rope'],
  patada: ['kickback', 'kick'], estiramiento: ['stretch'], estiramientos: ['stretch'],
  bulgara: ['split'], copa: ['goblet'],
  martillo: ['hammer'], concentrado: ['concentration'], predicador: ['preacher'], scott: ['preacher'],
  francés: ['french'], frances: ['french'], rompecraneos: ['skullcrusher', 'skull'],
  cinta: ['treadmill'], correr: ['running', 'run'], carrera: ['running'], bici: ['bike', 'bicycle', 'cycling'],
  eliptica: ['elliptical'], escaleras: ['stair', 'stairmaster'],
  arrastre: ['sled'], trineo: ['sled'], lastrado: ['weighted'], lastrada: ['weighted'],
  rodilla: ['knee'], rodillas: ['knee'], pie: ['standing'], sentado: ['seated'], tumbado: ['lying'],
  unilateral: ['one', 'single'], alterno: ['alternate'], alternas: ['alternate'],
}

// Diccionario inverso para que "squat" también encuentre "sentadilla" (en ejercicios propios en español)
const EN_TO_ES: Record<string, string[]> = {}
for (const [es, ens] of Object.entries(WORDS)) for (const en of ens) (EN_TO_ES[en] ??= []).push(es)

const DICT_KEYS = Object.keys(WORDS)

/** Sinónimos de una palabra; si no está tal cual en el diccionario, se buscan claves con erratas */
function synonyms(w: string): string[] {
  if (WORDS[w]) return WORDS[w]
  const typos = w.length >= 8 ? 2 : w.length >= 5 ? 1 : 0
  if (!typos) return []
  return DICT_KEYS.filter((k) => editDistance(w, k, typos) <= typos).flatMap((k) => WORDS[k])
}

export function exerciseQuery(q: string): string[][] {
  let s = norm(q)
  for (const [es, en] of PHRASES) s = s.replace(new RegExp(`\\b${norm(es)}\\b`, 'g'), en)
  // la palabra tal cual va primero: matchScore le da algo más de peso que a sus traducciones
  return dropStopwords(words(s)).map((w) => [...new Set([w, ...synonyms(w), ...(EN_TO_ES[w] ?? [])])])
}

const muscleText = (ms: string[]) => ms.map((m) => `${m} ${(MUSCLES as Record<string, { es: string }>)[m]?.es ?? ''}`).join(' ')

/** Texto indexable de un ejercicio: nombre + músculos (inglés y español) + material + categoría */
function exerciseText(e: Exercise): string {
  const eq = e.equipment ? `${e.equipment} ${EQUIPMENT_ES[e.equipment] ?? ''}` : ''
  return `${e.name} ${e.name.replace(/-/g, '')} ${muscleText(e.primary_muscles)} ${eq} ${e.category ?? ''}`
}

/** Ejercicios que coinciden con la búsqueda, ordenados por relevancia (el nombre pesa más) */
export function searchExercises(list: Exercise[], q: string): Exercise[] {
  const query = exerciseQuery(q)
  if (!query.length) return list
  return list
    .map((e, i) => ({ e, i, s: matchScore(query, exerciseText(e), `${e.name} ${e.name.replace(/-/g, '')}`) }))
    .filter((r) => r.s != null)
    .sort((a, b) => b.s! - a.s! || a.e.name.length - b.e.name.length || a.i - b.i)
    .map((r) => r.e)
}
