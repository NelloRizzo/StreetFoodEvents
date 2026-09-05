import { useCallback, useRef, useState, type DragEvent } from 'react'

import { deleteDocument, uploadDocument, type UploadedDocument } from '../lib/upload'
import styles from './DocumentUploader.module.scss'

type DocumentUploaderProps = {
  value?: UploadedDocument | null
  onChange: (data: UploadedDocument | null) => void
  label?: string
  type?: 'event' | 'stand'
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function DocumentUploader({ value, onChange, label, type }: DocumentUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const handleFile = useCallback(async (file: File) => {
    setIsUploading(true)
    try {
      const doc = await uploadDocument(file, type)
      onChange(doc)
    } finally {
      setIsUploading(false)
    }
  }, [onChange, type])

  const handleDrop = useCallback((event: DragEvent) => {
    event.preventDefault()
    setIsDragOver(false)

    if (event.dataTransfer.files.length > 0) {
      handleFile(event.dataTransfer.files[0]!)
    }
  }, [handleFile])

  const handleDragOver = (event: DragEvent) => {
    event.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => setIsDragOver(false)

  const removeDocument = async (publicId: string) => {
    await deleteDocument(publicId)
    onChange(null)
  }

  const dropZoneClass = `${styles.dropZone} ${isDragOver ? styles.dragOver : ''} ${isUploading ? styles.uploading : ''}`

  return (
    <div className={styles.wrapper}>
      {label && <span className={styles.label}>{label}</span>}

      {!value && (
        <div
          className={dropZoneClass}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
        >
          {isUploading ? (
            <span className={styles.hint}>Caricamento in corso...</span>
          ) : (
            <span className={styles.hint}>Trascina un documento PDF o clicca per caricare</span>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        hidden
        onChange={(e) => {
          if (e.target.files?.length) {
            handleFile(e.target.files[0]!)
          }
        }}
      />

      {value && (
        <div className={styles.fileCard}>
          <a href={value.url} target="_blank" rel="noopener noreferrer" className={styles.fileMain}>
            <span className={styles.fileName}>{value.originalName || 'documento.pdf'}</span>
            <span className={styles.fileMeta}>
              PDF - {formatBytes(value.bytes)}
            </span>
          </a>
          <div className={styles.fileActions}>
            <a href={value.url} target="_blank" rel="noopener noreferrer" className={styles.openBtn}>
              Apri
            </a>
            <button
              type="button"
              className={styles.removeBtn}
              onClick={() => removeDocument(value.publicId)}
              title="Rimuovi"
            >
              &times;
            </button>
          </div>
        </div>
      )}
    </div>
  )
}