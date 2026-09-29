import { beforeEach, describe, expect, it, vi } from 'vitest'

import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const fetchHomeBlogPosts = vi.fn()
vi.mock('../../lib/blog', async () => {
  const actual = await vi.importActual<typeof import('../../lib/blog')>('../../lib/blog')
  return { ...actual, fetchHomeBlogPosts: () => fetchHomeBlogPosts() }
})

import { BlogNewsAside } from '../../components/BlogNewsAside'
import type { BlogPost } from '../../lib/blog'

const makePost = (over: Partial<BlogPost>): BlogPost => ({
  id: 'p1',
  title: 'Notizia',
  slug: 'notizia',
  excerpt: null,
  coverImage: null,
  category: null,
  event: null,
  author: null,
  isPinned: false,
  pinnedAt: null,
  status: 'published',
  publishedAt: '2026-09-01T00:00:00.000Z',
  viewCount: 0,
  commentCount: 0,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  ...over,
})

const renderAside = () =>
  render(
    <MemoryRouter>
      <BlogNewsAside />
    </MemoryRouter>,
  )

describe('BlogNewsAside — aside notizie della home', () => {
  beforeEach(() => {
    fetchHomeBlogPosts.mockReset()
  })

  it('non rende nulla se non ci sono notizie (niente box vuoto in home)', async () => {
    fetchHomeBlogPosts.mockResolvedValue({ items: [] })
    const { container } = renderAside()
    await waitFor(() => expect(fetchHomeBlogPosts).toHaveBeenCalled())
    expect(container.querySelector('aside')).toBeNull()
  })

  it('non rende nulla se la richiesta fallisce', async () => {
    fetchHomeBlogPosts.mockRejectedValue(new Error('boom'))
    const { container } = renderAside()
    await waitFor(() => expect(container.querySelector('aside')).toBeNull())
  })

  it('mostra le notizie nell\'ordine ricevuto dall\'API', async () => {
    /* L'ordine (pinnate in testa + 5 ultime, deduplicato) e' responsabilita'
     * del backend: qui si verifica che il componente non lo riordini. */
    fetchHomeBlogPosts.mockResolvedValue({
      items: [
        makePost({ id: 'a', title: 'Pinnata', slug: 'pinnata', isPinned: true }),
        makePost({ id: 'b', title: 'Ultima uno', slug: 'ultima-1' }),
        makePost({ id: 'c', title: 'Ultima due', slug: 'ultima-2' }),
      ],
    })

    renderAside()

    /* "Vedi tutte" punta a /blog (indice), i post a /blog/:slug: si filtrano
     * quelli di dettaglio per verificare che l'ordine non venga cambiato. */
    const postLinks = (await screen.findAllByRole('link'))
      .filter((l) => (l.getAttribute('href') ?? '').split('/').length > 2)
    expect(postLinks.map((l) => l.textContent ?? '')).toEqual([
      expect.stringContaining('Pinnata'),
      expect.stringContaining('Ultima uno'),
      expect.stringContaining('Ultima due'),
    ])
    expect(postLinks[0]).toHaveAttribute('href', '/blog/pinnata')
  })

  it('segnala le notizie pinnate e il link alla pagina del blog', async () => {
    fetchHomeBlogPosts.mockResolvedValue({
      items: [makePost({ id: 'a', title: 'Pinnata', slug: 'pinnata', isPinned: true })],
    })

    renderAside()

    expect(await screen.findByText('In evidenza')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Vedi tutte/i })).toHaveAttribute('href', '/blog')
  })
})
