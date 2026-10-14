import { useEffect, useState } from 'react'

import { DEFAULT_FORMAT, posterMetrics, type PosterFormatId } from './socialCanvas'

/** Chiave unica per i due export: il formato scelto per il menu vale anche
 *  per i prodotti, perché l'operatore lo sceglie una volta e non a ogni
 *  apertura. */
const FORMAT_KEY = 'sfe-social-format'

function readStoredFormat(): PosterFormatId {
  try {
    const stored = localStorage.getItem(FORMAT_KEY)
    if (stored === 'feed' || stored === 'story') return stored
  } catch {
    /* localStorage non disponibile */
  }
  return DEFAULT_FORMAT
}

/** Formato delle immagini social, ricordato fra una sessione e l'altra.
 *  Il default è 9:16 (storie/reel): vedi `DEFAULT_FORMAT`. */
export function useSocialFormat(): [PosterFormatId, (f: PosterFormatId) => void] {
  const [format, setFormat] = useState<PosterFormatId>(readStoredFormat)

  useEffect(() => {
    try {
      localStorage.setItem(FORMAT_KEY, format)
    } catch {
      /* localStorage non disponibile */
    }
  }, [format])

  return [format, setFormat]
}

/** "1080 × 1920" — la dimensione è l'unica cosa che l'operatore deve poter
 *  leggere, e il formato scelto cambia le immagini prodotte. */
export function formatSizeLabel(format: PosterFormatId): string {
  const m = posterMetrics(format)
  return `${m.width} × ${m.height}`
}