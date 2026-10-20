import { useEffect, useRef, useState } from 'react'
import { supabase, uid } from '../lib/supabase'
import { fmtDay, ymd } from '../lib/dates'
import { Empty, Sheet, toast } from './ui'

interface Photo { id: number; day: string; path: string; url?: string }
const BUCKET = 'progress-photos'

/** Reduce la imagen a 1280 px JPEG antes de subirla */
async function compress(file: File): Promise<Blob> {
  const img = await createImageBitmap(file)
  const scale = Math.min(1, 1280 / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale)
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  return new Promise((res) => c.toBlob((b) => res(b!), 'image/jpeg', 0.82))
}

export default function ProgressPhotos() {
  const [photos, setPhotos] = useState<Photo[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState<Photo | null>(null)
  const input = useRef<HTMLInputElement>(null)

  async function load() {
    const { data } = await supabase.from('photos').select('*').order('day', { ascending: false }).limit(24)
    const list = (data ?? []) as Photo[]
    if (list.length) {
      // URLs firmadas temporales: el bucket es privado
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(list.map((p) => p.path), 3600)
      signed?.forEach((s, i) => { list[i].url = s.signedUrl ?? undefined })
    }
    setPhotos(list)
  }
  useEffect(() => { load() }, [])

  async function upload(f: File) {
    setBusy(true)
    try {
      const path = `${await uid()}/${ymd()}-${Date.now()}.jpg`
      const { error } = await supabase.storage.from(BUCKET).upload(path, await compress(f), { contentType: 'image/jpeg' })
      if (error) throw error
      await supabase.from('photos').insert({ day: ymd(), path })
      toast('📸 Foto guardada')
      load()
    } catch (e: any) { toast('⚠️ ' + e.message) }
    setBusy(false)
  }

  async function remove(p: Photo) {
    await supabase.storage.from(BUCKET).remove([p.path])
    await supabase.from('photos').delete().eq('id', p.id)
    setView(null); load()
  }

  return (
    <div className="stack">
      <input ref={input} type="file" accept="image/*" capture="environment" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }} />
      <button onClick={() => input.current?.click()} disabled={busy}>{busy ? <span className="spin" /> : '📸 Añadir foto'}</button>
      {photos && !photos.length && <Empty emoji="🖼️">Sin fotos. Solo tú puedes verlas.</Empty>}
      <div className="grid3">
        {photos?.map((p) => (
          <div key={p.id} onClick={() => setView(p)} style={{ cursor: 'pointer' }}>
            <img src={p.url} alt="" loading="lazy" style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', borderRadius: 12, border: '1px solid var(--line)' }} />
            <div className="tiny faint mono" style={{ textAlign: 'center' }}>{fmtDay(p.day, { day: 'numeric', month: 'short', year: '2-digit' })}</div>
          </div>
        ))}
      </div>
      <Sheet open={!!view} onClose={() => setView(null)} title={view ? fmtDay(view.day) : ''}>
        {view && (
          <div className="stack">
            <img src={view.url} alt="" style={{ width: '100%', borderRadius: 14 }} />
            <button className="btn-danger" onClick={() => remove(view)}>Eliminar foto</button>
          </div>
        )}
      </Sheet>
    </div>
  )
}
