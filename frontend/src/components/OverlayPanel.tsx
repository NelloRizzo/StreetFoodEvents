import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import styles from './OverlayPanel.module.scss'

type Props = {
  open: boolean
  title: string
  onClose: () => void
  /**
   * 'right' = drawer laterale (moduli lunghi: il contenuto scorre, i pulsanti
   * restano fissi in fondo). 'center' = modale (moduli brevi).
   */
  placement?: 'right' | 'center'
  /** Contenuto del piè di pagina, fuori dalla zona che scorre. */
  footer?: ReactNode
  children: ReactNode
}

/**
 * Pannello sovrapposto con overlay, chiusura con Escape / click fuori e blocco
 * dello scroll del body.
 *
 * Va in portal su `body`: dentro i layout admin ci sono elementi in
 * `position: fixed` (sidebar, topbar) che altrimenti taglierebbero il pannello.
 *
 * `ConfirmModal` non è riusabile qui perché è un dialogo di conferma (titolo +
 * messaggio + due pulsanti), non un contenitore per un modulo.
 */
export function OverlayPanel({ open, title, onClose, placement = 'center', footer, children }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    /* L'overlay parte dal body: senza questo, scrollando la pagina sotto si
       muoverebbe anche il contenitore del pannello. */
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    panelRef.current?.focus()
  }, [open])

  if (!open) return null

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={placement === 'right' ? styles.drawer : styles.modal}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Chiudi">
            &times;
          </button>
        </header>

        <div className={styles.body}>{children}</div>

        {footer && <footer className={styles.footer}>{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}