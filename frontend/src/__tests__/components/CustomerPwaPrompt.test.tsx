import { render, screen, waitFor, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const useRegisterSW = vi.fn()

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => useRegisterSW(),
}))

import { CustomerPwaPrompt } from '../../components/CustomerPwaPrompt'

/* Il bug: `useRegisterSW` di vite-plugin-pwa espone needRefresh/offlineReady
   come TUPLA [valore, setter]. Destrutturati come booleani diventano array,
   sempre truthy -> i banner restavano sempre visibili. */
type SwFlag = boolean | [boolean, (v: boolean) => void]

const swState = (
  overrides: Partial<{
    needRefresh: SwFlag
    offlineReady: SwFlag
    updateServiceWorker: (reload?: boolean) => Promise<void>
  }> = {},
) => {
  useRegisterSW.mockReturnValue({
    needRefresh: [false, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  })
}

describe('CustomerPwaPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('non mostra nessun banner quando le flag sono false', () => {
    swState()
    const { container } = render(<CustomerPwaPrompt />)
    expect(container.textContent).not.toMatch(/App pronta/i)
    expect(container.textContent).not.toMatch(/aggiornamento/i)
  })

  it('non mostra il banner aggiornamento per la tupla [false] (regressione array truthy)', () => {
    swState({ needRefresh: [false, vi.fn()] })
    render(<CustomerPwaPrompt />)
    expect(screen.queryByText(/È disponibile un aggiornamento/i)).toBeNull()
  })

  it('non mostra il toast offline per la tupla [false] (regressione array truthy)', () => {
    swState({ offlineReady: [false, vi.fn()] })
    render(<CustomerPwaPrompt />)
    expect(screen.queryByText(/App pronta/i)).toBeNull()
  })

  it('mostra il banner aggiornamento per la tupla [true]', () => {
    swState({ needRefresh: [true, vi.fn()] })
    render(<CustomerPwaPrompt />)
    expect(screen.getByText(/È disponibile un aggiornamento/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Aggiorna$/i })).toBeTruthy()
  })

  it('accetta anche la forma booleana (compatibilità)', () => {
    swState({ needRefresh: true, offlineReady: true })
    const { container } = render(<CustomerPwaPrompt />)
    expect(container.textContent).toMatch(/aggiornamento/i)
    expect(container.textContent).toMatch(/App pronta/i)
  })

  it('chiama updateServiceWorker e reload al click su "Aggiorna"', async () => {
    const updateServiceWorker = vi.fn().mockResolvedValue(undefined)
    const reload = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload },
      writable: true,
      configurable: true,
    })
    swState({ needRefresh: [true, vi.fn()], updateServiceWorker })

    render(<CustomerPwaPrompt />)
    act(() => { screen.getByRole('button', { name: /^Aggiorna$/i }).click() })

    await waitFor(() => expect(updateServiceWorker).toHaveBeenCalledWith(true))
    expect(screen.getByText(/Aggiornamento in corso/i)).toBeTruthy()
  })

  it('nasconde il toast offline dopo il timer', async () => {
    vi.useFakeTimers()
    try {
      swState({ offlineReady: [true, vi.fn()] })
      render(<CustomerPwaPrompt />)
      expect(screen.getByText(/App pronta/i)).toBeTruthy()
      act(() => { vi.advanceTimersByTime(5000) })
      expect(screen.queryByText(/App pronta/i)).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('chiude il toast offline al click sulla X', () => {
    swState({ offlineReady: [true, vi.fn()] })
    render(<CustomerPwaPrompt />)
    /* In jsdom non siamo in standalone, quindi c'è anche il banner di
       installazione con la sua X: il toast offline è il primo dei due. */
    act(() => { screen.getAllByRole('button', { name: /^Chiudi$/i })[0].click() })
    expect(screen.queryByText(/App pronta/i)).toBeNull()
  })

  it('chiude il banner aggiornamento con la X senza applicare l\'update', () => {
    const updateServiceWorker = vi.fn()
    swState({ needRefresh: [true, vi.fn()], updateServiceWorker })
    render(<CustomerPwaPrompt />)
    act(() => { screen.getAllByRole('button', { name: /^Chiudi$/i })[0].click() })
    expect(screen.queryByText(/È disponibile un aggiornamento/i)).toBeNull()
    expect(updateServiceWorker).not.toHaveBeenCalled()
  })
})
