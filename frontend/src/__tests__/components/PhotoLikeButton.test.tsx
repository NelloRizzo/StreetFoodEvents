import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { PhotoLikeButton } from '../../components/PhotoLikeButton'
import { apiRequest } from '../../lib/api'

/* Il pulsante vive dentro una card che apre il lightbox: il click non deve
   arrivare al contenitore, altrimenti mettere un like aprirebbe la foto. Il
   conteggio arriva dal server, quindi la card viene ricaricata dopo il toggle. */
vi.mock('../../lib/api', () => ({
  apiRequest: vi.fn(),
}))

const mockedApiRequest = vi.mocked(apiRequest)

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('PhotoLikeButton', () => {
  it('mostra cuore e conteggio in base allo stato', () => {
    const { rerender } = render(
      <PhotoLikeButton eventId="e1" photoId="p1" likeCount={4} liked={false} onChange={vi.fn()} />,
    )
    const button = screen.getByRole('button', { name: 'Metti «mi piace»' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(button.textContent).toContain('4')
    expect(button.textContent).toContain('\u2661')

    rerender(<PhotoLikeButton eventId="e1" photoId="p1" likeCount={5} liked onChange={vi.fn()} />)
    const liked = screen.getByRole('button', { name: 'Togli il «mi piace»' })
    expect(liked).toHaveAttribute('aria-pressed', 'true')
    expect(liked.textContent).toContain('\u2665')
    expect(liked.textContent).toContain('5')
  })

  it('chiama l\'API con il deviceId e ricarica la lista', async () => {
    mockedApiRequest.mockResolvedValue({ liked: true, likeCount: 1 })
    const onChange = vi.fn()
    render(<PhotoLikeButton eventId="e1" photoId="p1" likeCount={0} liked={false} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Metti «mi piace»' }))

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1))
    expect(mockedApiRequest).toHaveBeenCalledWith(
      '/events/e1/photos/p1/like',
      expect.objectContaining({ method: 'POST' }),
    )
    const options = mockedApiRequest.mock.calls[0]![1] as { bodyJson?: { deviceId?: string } }
    expect(options.bodyJson?.deviceId).toEqual(expect.any(String))
  })

  it('non fa risalire il click alla card', async () => {
    mockedApiRequest.mockResolvedValue({ liked: true, likeCount: 1 })
    const onCardClick = vi.fn()
    render(
      <div onClick={onCardClick}>
        <PhotoLikeButton eventId="e1" photoId="p1" likeCount={0} liked={false} onChange={vi.fn()} />
      </div>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Metti «mi piace»' }))

    await waitFor(() => expect(mockedApiRequest).toHaveBeenCalledTimes(1))
    expect(onCardClick).not.toHaveBeenCalled()
  })

  it('se l\'API fallisce non ricarica (nessun banner in griglia)', async () => {
    mockedApiRequest.mockRejectedValue(new Error('rete'))
    const onChange = vi.fn()
    render(<PhotoLikeButton eventId="e1" photoId="p1" likeCount={0} liked={false} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Metti «mi piace»' }))

    await waitFor(() => expect(mockedApiRequest).toHaveBeenCalledTimes(1))
    expect(onChange).not.toHaveBeenCalled()
  })
})
