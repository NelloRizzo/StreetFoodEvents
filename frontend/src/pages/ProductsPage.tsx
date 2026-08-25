import { useEffect, useState } from 'react'

import { apiRequest } from '../lib/api'
import { type UploadedImage } from '../lib/upload'
import { ImageUploader } from '../components/ImageUploader'
import { ConfirmModal } from '../components/ConfirmModal'
import styles from './ProductsPage.module.scss'

const ALLERGEN_OPTIONS = [
  { value: 'gluten', label: 'Glutine' },
  { value: 'crustaceans', label: 'Crostacei' },
  { value: 'eggs', label: 'Uova' },
  { value: 'fish', label: 'Pesce' },
  { value: 'peanuts', label: 'Arachidi' },
  { value: 'soy', label: 'Soia' },
  { value: 'milk', label: 'Latte' },
  { value: 'tree-nuts', label: 'Frutta a guscio' },
  { value: 'celery', label: 'Sedano' },
  { value: 'mustard', label: 'Senape' },
  { value: 'sesame', label: 'Sesamo' },
  { value: 'sulphites', label: 'Solfiti' },
  { value: 'lupins', label: 'Lupini' },
  { value: 'molluscs', label: 'Molluschi' },
]

const ALLERGEN_LABELS: Record<string, string> = Object.fromEntries(
  ALLERGEN_OPTIONS.map((o) => [o.value, o.label])
)

type Product = {
  id: string
  name: string
  description: string | null
  ingredients: string[]
  allergens: string[]
  isFrozen: boolean
  price: number
  coverImage: unknown | null
  gallery: unknown[]
  createdAt: string
  updatedAt: string
}

type ProductFormData = {
  name: string
  description: string
  ingredients: string
  allergens: string[]
  isFrozen: boolean
  price: string
  coverImage: UploadedImage | null
  gallery: UploadedImage[]
}

const emptyForm: ProductFormData = {
  name: '',
  description: '',
  ingredients: '',
  allergens: [],
  isFrozen: false,
  price: '',
  coverImage: null,
  gallery: [],
}

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ProductFormData>(emptyForm)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

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
      description: product.description ?? '',
      ingredients: product.ingredients.join(', '),
      allergens: product.allergens ?? [],
      isFrozen: product.isFrozen ?? false,
      price: String(product.price),
      coverImage: product.coverImage as UploadedImage | null,
      gallery: product.gallery as UploadedImage[],
    })
    setEditingId(product.id)
    setShowForm(true)
  }

  const toggleAllergen = (value: string) => {
    setForm((prev) => ({
      ...prev,
      allergens: prev.allergens.includes(value)
        ? prev.allergens.filter((a) => a !== value)
        : [...prev.allergens, value],
    }))
  }

  const handleSubmit = async () => {
    const bodyJson = {
      name: form.name,
      description: form.description.trim() || null,
      ingredients: form.ingredients.split(',').map((s) => s.trim()).filter(Boolean),
      allergens: form.allergens,
      isFrozen: form.isFrozen,
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
    setDeleteTarget(id)
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
              <label htmlFor="prod-desc">Descrizione</label>
              <textarea id="prod-desc" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descrizione breve del prodotto (opzionale)" />
            </div>

            <div className={styles.field}>
              <label htmlFor="prod-ingredients">Ingredienti (separati da virgola)</label>
              <textarea id="prod-ingredients" rows={2} value={form.ingredients} onChange={(e) => setForm({ ...form, ingredients: e.target.value })} placeholder="es. farina, pomodoro, mozzarella, basilico" />
            </div>

            <div className={styles.field}>
              <label>Allergeni (Reg. UE 1169/2011)</label>
              <div className={styles.allergenGrid}>
                {ALLERGEN_OPTIONS.map((opt) => (
                  <label key={opt.value} className={styles.allergenCheck}>
                    <input
                      type="checkbox"
                      checked={form.allergens.includes(opt.value)}
                      onChange={() => toggleAllergen(opt.value)}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={form.isFrozen}
                onChange={(e) => setForm({ ...form, isFrozen: e.target.checked })}
              />
              <span>Prodotto congelato *</span>
            </label>
            <p className={styles.fieldHint}>
              * I prodotti congelati sono contrassegnati con un asterisco (*) conformemente al D.Lgs. 231/2017.
            </p>

            <div className={styles.field}>
              <label htmlFor="prod-price">Prezzo standard</label>
              <input id="prod-price" type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
            </div>

            <ImageUploader
                mode="single"
                type="product"
                value={form.coverImage}
                onChange={(data) => setForm({ ...form, coverImage: data as UploadedImage | null })}
                label="Immagine di copertina"
              />

            <ImageUploader
                mode="multiple"
                type="product"
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
                <strong className={styles.cardName}>
                  {product.name}
                  {product.isFrozen && <span className={styles.frozenBadge}>*</span>}
                </strong>
                <span className={styles.cardPrice}>{product.price.toFixed(2)} &euro;</span>
                {product.description && (
                  <span className={styles.cardIngredients}>{product.description}</span>
                )}
                {product.ingredients.length > 0 && (
                  <span className={styles.cardIngredients}>Ingredienti: {product.ingredients.join(', ')}</span>
                )}
                {product.allergens.length > 0 && (
                  <span className={styles.cardAllergens}>
                    Allergeni: {product.allergens.map((a) => ALLERGEN_LABELS[a] ?? a).join(', ')}
                  </span>
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

      <ConfirmModal
        open={deleteTarget !== null}
        variant="confirm"
        title="Eliminare prodotto?"
        message="Questa azione è irreversibile."
        danger
        confirmLabel="Elimina"
        onConfirm={async () => {
          if (!deleteTarget) return
          await apiRequest(`/products/${deleteTarget}`, { method: 'DELETE' })
          setDeleteTarget(null)
          await fetchProducts()
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
