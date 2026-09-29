import { apiRequest } from './api'
import type { UploadedImage } from './upload'

export type BlogCategory = {
  id: string
  name: string
  slug: string
  description: string | null
  color: string | null
}

export type BlogEventRef = {
  id: string
  name: string | null
  startDate: string | null
  endDate: string | null
  coverImage: UploadedImage | null
  logo: UploadedImage | null
}

export type BlogAuthor = {
  id: string
  name: string
}

export type BlogPostStatus = 'draft' | 'published'

/* Il corpo (contentHtml) arriva gia' sanificato dal backend, che forza
 * target="_blank" su ogni <a>: vedi sanitizeBlogHtml lato API. */
export type BlogPost = {
  id: string
  title: string
  slug: string
  excerpt: string | null
  contentHtml?: string
  coverImage: UploadedImage | null
  category: BlogCategory | null
  event: BlogEventRef | null
  author: BlogAuthor | null
  isPinned: boolean
  pinnedAt: string | null
  status: BlogPostStatus
  publishedAt: string | null
  viewCount: number
  commentCount: number
  createdAt: string
  updatedAt: string
}

export type BlogComment = {
  id: string
  postId: string
  authorName: string
  body: string
  status: 'visible' | 'hidden'
  createdAt: string
  userId?: string
  post?: { title: string; slug: string } | null
}

export type BlogListResponse = {
  items: BlogPost[]
  total: number
  page: number
  limit: number
  hasMore?: boolean
}

export type BlogPostInput = {
  title: string
  contentHtml: string
  excerpt?: string | null
  coverImage?: UploadedImage | null
  categoryId?: string | null
  eventId?: string | null
  status?: BlogPostStatus
}

function query(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  })
  const s = search.toString()
  return s ? `?${s}` : ''
}

/* ---------------- pubblico ---------------- */

export async function fetchBlogPosts(
  options: { category?: string | null; eventId?: string | null; search?: string | null; page?: number; limit?: number } = {},
): Promise<BlogListResponse> {
  return apiRequest<BlogListResponse>(
    `/blog${query({
      category: options.category,
      eventId: options.eventId,
      search: options.search,
      page: options.page ?? 1,
      limit: options.limit ?? 10,
    })}`,
  )
}

/* Aside della home: pinnate in testa + 5 ultime, gia' deduplicato lato API. */
export async function fetchHomeBlogPosts(): Promise<{ items: BlogPost[] }> {
  return apiRequest<{ items: BlogPost[] }>('/blog/home')
}

export async function fetchBlogPost(slug: string): Promise<BlogPost> {
  const data = await apiRequest<{ item: BlogPost }>(`/blog/${slug}`)
  return data.item
}

export async function fetchBlogCategories(): Promise<BlogCategory[]> {
  const data = await apiRequest<{ items: BlogCategory[] }>('/blog/categories')
  return data.items
}

export async function fetchBlogComments(slug: string): Promise<BlogComment[]> {
  const data = await apiRequest<{ items: BlogComment[] }>(`/blog/${slug}/comments`)
  return data.items
}

/* Richiede un utente registrato: senza sessione l'API risponde 401. */
export async function createBlogComment(slug: string, body: string): Promise<BlogComment> {
  const data = await apiRequest<{ item: BlogComment }>(`/blog/${slug}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  })
  return data.item
}

/* ---------------- gestione ---------------- */

export async function fetchManageBlogPosts(
  options: { status?: string; category?: string | null; search?: string | null; page?: number; limit?: number } = {},
): Promise<BlogListResponse> {
  return apiRequest<BlogListResponse>(
    `/blog/manage/posts${query({
      status: options.status,
      category: options.category,
      search: options.search,
      page: options.page ?? 1,
      limit: options.limit ?? 20,
    })}`,
  )
}

/* Dettaglio in gestione: include il corpo e non filtra per status, quindi
 * serve anche ad aprire una bozza. Diversamente dall'endpoint pubblico non
 * incrementa il contatore visualizzazioni. */
export async function fetchManageBlogPost(postId: string): Promise<BlogPost> {
  const data = await apiRequest<{ item: BlogPost }>(`/blog/manage/posts/${postId}`)
  return data.item
}

export async function createBlogPost(input: BlogPostInput): Promise<BlogPost> {
  const data = await apiRequest<{ item: BlogPost }>('/blog/manage/posts', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return data.item
}

export async function updateBlogPost(postId: string, input: Partial<BlogPostInput> & { isPinned?: boolean }): Promise<BlogPost> {
  const data = await apiRequest<{ item: BlogPost }>(`/blog/manage/posts/${postId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  return data.item
}

export async function deleteBlogPost(postId: string): Promise<void> {
  await apiRequest<void>(`/blog/manage/posts/${postId}`, { method: 'DELETE' })
}

export async function fetchManageBlogCategories(): Promise<BlogCategory[]> {
  const data = await apiRequest<{ items: BlogCategory[] }>('/blog/manage/categories')
  return data.items
}

export async function createBlogCategory(input: { name: string; slug?: string; description?: string; color?: string }): Promise<BlogCategory> {
  const data = await apiRequest<{ item: BlogCategory }>('/blog/manage/categories', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return data.item
}

export async function updateBlogCategory(
  categoryId: string,
  input: { name?: string; slug?: string; description?: string | null; color?: string | null },
): Promise<BlogCategory> {
  const data = await apiRequest<{ item: BlogCategory }>(`/blog/manage/categories/${categoryId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  return data.item
}

export async function deleteBlogCategory(categoryId: string): Promise<void> {
  await apiRequest<void>(`/blog/manage/categories/${categoryId}`, { method: 'DELETE' })
}

export async function fetchManageBlogComments(
  options: { postId?: string | null; status?: string | null; limit?: number } = {},
): Promise<BlogComment[]> {
  const data = await apiRequest<{ items: BlogComment[] }>(
    `/blog/manage/comments${query({ postId: options.postId, status: options.status, limit: options.limit ?? 50 })}`,
  )
  return data.items
}

export async function setBlogCommentStatus(commentId: string, status: 'visible' | 'hidden'): Promise<BlogComment> {
  const data = await apiRequest<{ item: BlogComment }>(`/blog/manage/comments/${commentId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
  return data.item
}

export async function deleteBlogComment(commentId: string): Promise<void> {
  await apiRequest<void>(`/blog/manage/comments/${commentId}`, { method: 'DELETE' })
}
