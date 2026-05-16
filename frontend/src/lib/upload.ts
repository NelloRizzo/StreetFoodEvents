import { apiRequest } from './api'

export type UploadedImage = {
  url: string
  publicId: string
  width: number
  height: number
  format: string
  bytes: number
}

async function uploadFile<T>(path: string, file: File, fieldName: string): Promise<T> {
  const formData = new FormData()
  formData.append(fieldName, file)

  const response = await fetch(`/api${path}`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  })

  const payload = (await response.json().catch(() => null)) as { message?: string } | null

  if (!response.ok) {
    throw new Error(payload?.message ?? 'Upload failed')
  }

  return payload as T
}

export async function uploadImage(file: File): Promise<UploadedImage> {
  const data = await uploadFile<{ item: UploadedImage }>('/upload/image', file, 'image')
  return data.item
}

export async function uploadGallery(files: File[]): Promise<UploadedImage[]> {
  const formData = new FormData()
  for (const file of files) {
    formData.append('images', file)
  }

  const response = await fetch('/api/upload/gallery', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  })

  const payload = (await response.json().catch(() => null)) as { message?: string } | null

  if (!response.ok) {
    throw new Error(payload?.message ?? 'Upload failed')
  }

  return (payload as { items: UploadedImage[] }).items
}

export async function deleteImage(publicId: string): Promise<void> {
  await apiRequest('/upload/image', {
    method: 'DELETE',
    bodyJson: { publicId },
  })
}

export async function deleteGallery(publicIds: string[]): Promise<void> {
  await apiRequest('/upload/gallery', {
    method: 'DELETE',
    bodyJson: { publicIds },
  })
}
