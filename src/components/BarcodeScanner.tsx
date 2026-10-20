import { CameraOff, Flashlight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128']

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> }

async function makeDetector(): Promise<Detector> {
  const Native = (window as any).BarcodeDetector
  if (Native) {
    const supported: string[] = await Native.getSupportedFormats?.() ?? []
    if (FORMATS.some((f) => supported.includes(f))) return new Native({ formats: FORMATS })
  }
  // iOS Safari y otros sin soporte nativo: polyfill zxing-wasm
  const { BarcodeDetector } = await import('barcode-detector/ponyfill')
  return new BarcodeDetector({ formats: FORMATS as any }) as unknown as Detector
}

export default function BarcodeScanner({ onDetect }: { onDetect: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [err, setErr] = useState<string | null>(null)
  const [torch, setTorch] = useState<MediaStreamTrack | null>(null)

  useEffect(() => {
    let stream: MediaStream | null = null
    let raf = 0
    let stopped = false
    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
        const v = video.current!
        v.srcObject = stream
        await v.play()
        const track = stream.getVideoTracks()[0]
        if ((track.getCapabilities?.() as any)?.torch) setTorch(track)
        const detector = await makeDetector()
        let last = 0
        const tick = async (t: number) => {
          if (stopped) return
          if (t - last > 180 && v.readyState >= 2) {
            last = t
            try {
              const codes = await detector.detect(v)
              if (codes[0]?.rawValue) {
                navigator.vibrate?.(60)
                stopped = true
                onDetect(codes[0].rawValue)
                return
              }
            } catch { /* frame no válido */ }
          }
          raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      } catch (e: any) {
        setErr(e?.name === 'NotAllowedError' ? 'Permiso de cámara denegado' : 'No se pudo abrir la cámara')
      }
    })()
    return () => { stopped = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()) }
  }, [onDetect])

  if (err) return <div className="empty"><span className="big"><CameraOff size={30} strokeWidth={1.5} /></span>{err}. Usa la búsqueda manual.</div>

  return (
    <div className="scanner">
      <video ref={video} playsInline muted />
      <div className="reticle" />
      <div className="laser" />
      {torch && (
        <button className="btn-icon" style={{ position: 'absolute', right: 10, bottom: 10 }}
          onClick={() => torch.applyConstraints({ advanced: [{ torch: true } as any] })}><Flashlight size={18} /></button>
      )}
    </div>
  )
}
