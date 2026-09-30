import { useEffect, useState, type ReactNode } from 'react'
import styles from './ConfirmModal.module.scss'

type Props = {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm?: (promptValue?: string, consent?: boolean) => void
  onCancel?: () => void
  variant?: 'confirm' | 'alert' | 'prompt'
  danger?: boolean
  showConsent?: boolean
  consentLabel?: string
  /** Contenuto extra sopra i pulsanti (es. campi di input della consegna). */
  children?: ReactNode
  /** Disabilita il pulsante di conferma (input obbligatori non ancora valorizzati). */
  confirmDisabled?: boolean
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Conferma',
  cancelLabel = 'Annulla',
  onConfirm,
  onCancel,
  variant = 'confirm',
  danger = false,
  showConsent = false,
  consentLabel = '',
  children,
  confirmDisabled = false,
}: Props) {
  const [promptValue, setPromptValue] = useState('')
  const [consentGiven, setConsentGiven] = useState(false)

  useEffect(() => {
    if (open) { setPromptValue(''); setConsentGiven(false) }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel?.()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.message}>{message}</p>
        {variant === 'prompt' && (
          <input
            className={styles.promptInput}
            value={promptValue}
            onChange={(e) => setPromptValue(e.target.value)}
            placeholder="Inserisci..."
            autoFocus
          />
        )}
        {showConsent && variant === 'prompt' && (
          <label className={styles.consentLabel}>
            <input
              type="checkbox"
              checked={consentGiven}
              onChange={(e) => setConsentGiven(e.target.checked)}
              className={styles.consentCheckbox}
            />
            {consentLabel}
          </label>
        )}
        {children}
        <div className={styles.actions}>
          {variant !== 'alert' && (
            <button className={styles.cancelBtn} onClick={onCancel}>
              {cancelLabel}
            </button>
          )}
          <button
            className={`${styles.confirmBtn} ${danger ? styles.dangerBtn : ''}`}
            onClick={() => onConfirm?.(variant === 'prompt' ? promptValue : undefined, variant === 'prompt' ? consentGiven : undefined)}
            autoFocus={variant !== 'prompt'}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
