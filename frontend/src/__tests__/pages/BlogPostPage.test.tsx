import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { BlogPostPage } from '../../pages/BlogPostPage'
import type { BlogComment, BlogPost } from '../../lib/blog'
import type { AuthUser } from '../../features/auth/auth-context'

const authState = {
  isAuthenticated: false,
  user: null as AuthUser | null,
  logout: vi.fn(async () => {}),
}

vi.mock('../../features/auth/auth-context', () => ({
  useAuth: () => authState,
}))

const fetchBlogPost = vi.fn()
const fetchBlogComments = vi.fn()
const createBlogComment = vi.fn()

vi.mock('../../lib/blog', async () => {
  const actual = await vi.importActual<typeof import('../../lib/blog')>('../../lib/blog')
  return {
    ...actual,
    fetchBlogPost: (...args: unknown[]) => fetchBlogPost(...args),
    fetchBlogComments: (...args: unknown[]) => fetchBlogComments(...args),
    createBlogComment: (...args: unknown[]) => createBlogComment(...args),
  }
})

const post: BlogPost = {
  id: 'p1',
  title: 'La nuova stagione',
  slug: 'la-nuova-stagione',
  excerpt: 'Aperture e novita\'.',
  coverImage: null,
  contentHtml:
    '<p>Ciao</p>'
    + '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer nofollow">Sito</a></p>',
  category: { id: 'c1', name: 'News', slug: 'news', description: null, color: null },
  event: {
    id: 'e1',
    name: 'Street Food 2027',
    startDate: '2027-06-01T00:00:00.000Z',
    endDate: '2027-06-03T00:00:00.000Z',
    logo: null,
    coverImage: null,
  },
  author: { id: 'u1', name: 'Redazione' },
  isPinned: true,
  pinnedAt: '2026-09-01T00:00:00.000Z',
  status: 'published',
  publishedAt: '2026-09-01T00:00:00.000Z',
  viewCount: 12,
  commentCount: 1,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
}

const comment = (over: Partial<BlogComment>): BlogComment => ({
  id: 'cm1',
  postId: 'p1',
  body: 'Ottima notizia!',
  authorName: 'Carla',
  status: 'visible',
  createdAt: '2026-09-02T00:00:00.000Z',
  ...over,
})

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/blog/la-nuova-stagione']}>
      <Routes>
        <Route path="/blog/:slug" element={<BlogPostPage />} />
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>,
  )

describe('BlogPostPage — dettaglio notizia', () => {
  beforeEach(() => {
    fetchBlogPost.mockReset().mockResolvedValue(post)
    fetchBlogComments.mockReset().mockResolvedValue([comment({})])
    createBlogComment.mockReset()
    authState.isAuthenticated = false
    authState.user = null
  })

  it('mostra titolo, categoria, evento collegato e contenuto', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'La nuova stagione' })).toBeTruthy()
    expect(screen.getByText('News')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Street Food 2027' })).toHaveAttribute('href', '/events/e1')
    expect(screen.getByText(/12 visualizzazioni/)).toBeTruthy()
  })

  it('rende il contenuto sanificato dal backend senza alterarlo (i link restano _blank)', async () => {
    /* La garanzia "ogni link si apre in una nuova scheda" e' del backend
     * (sanitizeBlogHtml in scrittura e in lettura, coperto dai test di
     * integrazione): qui si verifica che la pagina non tocchi l'HTML. */
    renderPage()

    const link = await screen.findByRole('link', { name: 'Sito' })
    expect(link).toHaveAttribute('target', '_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it('mostra i commenti pubblicati', async () => {
    renderPage()

    expect(await screen.findByText('Commenti (1)')).toBeTruthy()
    expect(screen.getByText('Ottima notizia!')).toBeTruthy()
    expect(screen.getByText('Carla')).toBeTruthy()
  })

  it('richiede il login per commentare (invito ad accedere)', async () => {
    renderPage()

    expect(await screen.findByText(/Accedi/)).toBeTruthy()
    expect(screen.queryByPlaceholderText('Scrivi un commento...')).toBeNull()
  })

  it('l\'utente autenticato pubblica un commento e lo vede subito in lista', async () => {
    authState.isAuthenticated = true
    createBlogComment.mockResolvedValue(comment({ id: 'cm2', body: 'Commento nuovo' }))

    renderPage()

    const textarea = await screen.findByPlaceholderText('Scrivi un commento...')
    fireEvent.change(textarea, { target: { value: 'Commento nuovo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Pubblica commento' }))

    await waitFor(() => expect(createBlogComment).toHaveBeenCalledWith('la-nuova-stagione', 'Commento nuovo'))
    expect(await screen.findByText('Commento nuovo')).toBeTruthy()
    expect(screen.getByText('Commento pubblicato.')).toBeTruthy()
  })

  it('se la notizia non esiste torna al blog', async () => {
    fetchBlogPost.mockRejectedValue(new Error('404'))
    fetchBlogComments.mockResolvedValue([])

    renderPage()

    expect(await screen.findByText('Impossibile caricare la notizia')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Torna al blog' })).toHaveAttribute('href', '/blog')
  })
})
