import { useEffect, useState } from 'react'

import { apiRequest } from '../lib/api'
import { type UploadedImage } from '../lib/upload'
import { ImageUploader } from '../components/ImageUploader'
import styles from './ProductsPage.module.scss'

type Product = {
  id: string
  name: string
  ingredients: string[]
  price: number
  coverImage: unknown | null
  gallery: unknown[]
  createdAt: string
  updatedAt: string
}

type ProductFormData = {
  name: string
  ingredients: string
  price: string
  coverImage: UploadedImage | null
  gallery: UploadedImage[]
}

const emptyForm: ProductFormData = { name: '', ingredients: '', price: '', coverImage: null, gallery: [] }

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ProductFormData>(emptyForm)

  const fetchProducts = async () => {
    const data = await apiRequest<{ items: Product[] }>('/products')
    setProducts(data.items)
    setIsLoading(false)
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  const openCreate = () => {
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(true)
  }

  const openEdit = (product: Product) => {
    setForm({
      name: product.name,
      ingredients: product.ingredients.join(', '),
      price: String(product.price),
      coverImage: product.coverImage as UploadedImage | null,
      gallery: product.gallery as UploadedImage[],
    })
    setEditingId(product.id)
    setShowForm(true)
  }

  const handleSubmit = async () => {
    const bodyJson = {
      name: form.name,
      ingredients: form.ingredients.split(',').map((s) => s.trim()).filter(Boolean),
      price: Number(form.price),
      coverImage: form.coverImage,
      gallery: form.gallery,
    }

    if (editingId) {
      await apiRequest(`/products/${editingId}`, {
        method: 'PATCH',
        bodyJson,
      })
    } else {
      await apiRequest('/products', {
        method: 'POST',
        bodyJson,
      })
    }

    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm)
    await fetchProducts()
  }

  const handleDelete = async (id: string) => {
    await apiRequest(`/products/${id}`, { method: 'DELETE' })
    await fetchProducts()
  }

  if (isLoading) return null

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <div className={styles.header}>
          <div>
            <span className="eyebrow">Gestione</span>
            <h1 className={styles.title}>Prodotti</h1>
          </div>
          <button className={styles.primaryBtn} onClick={openCreate}>
            Nuovo prodotto
          </button>
        </div>

        {showForm && (
          <form className={styles.form} onSubmit={(e) => { e.preventDefault(); handleSubmit() }}>
            <div className={styles.field}>
              <label htmlFor="prod-name">Nome</label>
              <input id="prod-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>

            <div className={styles.field}>
              <label htmlFor="prod-ingredients">Ingredienti (separati da virgola)</label>
              <input id="prod-ingredients" value={form.ingredients} onChange={(e) => setForm({ ...form, ingredients: e.target.value })} />
            </div>

            <div className={styles.field}>
              <label htmlFor="prod-price">Prezzo standard</label>
              <input id="prod-price" type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
            </div>

            <ImageUploader
              mode="single"
              value={form.coverImage}
              onChange={(data) => setForm({ ...form, coverImage: data as UploadedImage | null })}
              label="Immagine di copertina"
            />

            <ImageUploader
              mode="multiple"
              value={form.gallery}
              onChange={(data) => setForm({ ...form, gallery: data as UploadedImage[] })}
              label="Galleria"
            />

            <div className={styles.formActions}>
              <button type="submit" className={styles.primaryBtn}>
                {editingId ? 'Salva modifiche' : 'Crea prodotto'}
              </button>
              <button type="button" className={styles.secondaryBtn} onClick={() => setShowForm(false)}>
                Annulla
              </button>
            </div>
          </form>
        )}

        <div className={styles.list}>
          {products.map((product) => (
            <article key={product.id} className={styles.card}>
              <div className={styles.cardBody}>
                <strong className={styles.cardName}>{product.name}</strong>
                <span className={styles.cardPrice}>{product.price.toFixed(2)} &euro;</span>
                {product.ingredients.length > 0 && (
                  <span className={styles.cardIngredients}>{product.ingredients.join(', ')}</span>
                )}
              </div>
              <div className={styles.cardActions}>
                <button className={styles.textBtn} onClick={() => openEdit(product)}>
                  Modifica
                </button>
                <button className={styles.dangerBtn} onClick={() => handleDelete(product.id)}>
                  Elimina
                </button>
              </div>
            </article>
          ))}

          {products.length === 0 && (
            <p className={styles.empty}>Nessun prodotto. Creane uno nuovo.</p>
          )}
        </div>
      </div>
    </div>
  )
}
