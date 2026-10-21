// Avisos entre pantallas: cuando se guarda un dato que afecta a otras partes (p. ej. los avisos flotantes)
export type AppEvent = 'weight-saved' | 'bodyfat-saved'

export const emit = (e: AppEvent) => window.dispatchEvent(new CustomEvent(`np:${e}`))

export function on(e: AppEvent, fn: () => void): () => void {
  const h = () => fn()
  window.addEventListener(`np:${e}`, h)
  return () => window.removeEventListener(`np:${e}`, h)
}
