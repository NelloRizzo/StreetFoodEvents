import { useCallback, useRef, useState, type DragEvent } from 'react'

import { deleteImage, uploadGallery, uploadImage, type UploadedImage } from '../lib/upload'
import styles from './ImageUploader.module.scss'

type ImageUploaderProps = {
  mode: 'single' | 'multiple'
  value?: UploadedImage | UploadedImage[] | null
  onChange: (data: UploadedImage | UploadedImage[] | null) => void
  label?: string
  type?: 'stand' | 'event' | 'product' | 'user' | 'poi'
}

export function ImageUploader({ mode, value, onChange, label, type }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const images = mode === 'single'
    ? (value ? [value as UploadedImage] : [])
    : (value as UploadedImage[] | undefined ?? [])

  const handleFiles = useCallback(async (files: FileList) => {
    setIsUploading(true)
    try {
      if (mode === 'single') {
        const img = await uploadImage(files[0]!, type)
        onChange(img)
      } else {
        const imgs = await uploadGallery(Array.from(files), type)
        onChange([...images, ...imgs])
      }
    } finally {
      setIsUploading(false)
    }
  }, [mode, onChange, images, type])

  const handleDrop = useCallback((event: DragEvent) => {
    event.preventDefault()
    setIsDragOver(false)

    if (event.dataTransfer.files.length > 0) {
      handleFiles(event.dataTransfer.files)
    }
  }, [handleFiles])

  const handleDragOver = (event: DragEvent) => {
    event.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => setIsDragOver(false)

  const removeImage = async (publicId: string) => {
    await deleteImage(publicId)

    if (mode === 'single') {
      onChange(null)
    } else {
      onChange((value as UploadedImage[]).filter((img) => img.publicId !== publicId))
    }
  }

  const dropZoneClass = `${styles.dropZone} ${isDragOver ? styles.dragOver : ''} ${isUploading ? styles.uploading : ''}`

  return (
    <div className={styles.wrapper}>
      {label && <span className={styles.label}>{label}</span>}

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
          <span className={styles.hint}>
            {mode === 'single' ? 'Trascina un\'immagine o clicca per caricare' : 'Trascina immagini o clicca per caricare'}
          </span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple={mode === 'multiple'}
        hidden
        onChange={(e) => {
          if (e.target.files?.length) {
            handleFiles(e.target.files)
          }
        }}
      />

      {images.length > 0 && (
        <div className={styles.previewGrid}>
          {images.map((img) => (
            <div key={img.publicId} className={styles.previewCard}>
              <img src={img.url} alt="" className={styles.previewImg} />
              <button
                type="button"
                className={styles.removeBtn}
                onClick={(e) => { e.stopPropagation(); removeImage(img.publicId) }}
                title="Rimuovi"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
