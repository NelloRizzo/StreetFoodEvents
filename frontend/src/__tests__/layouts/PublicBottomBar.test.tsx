import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../features/auth/auth-context', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { id: 'u1', firstName: 'Ada', lastName: 'B', email: 'ada@example.com' },
    logout: vi.fn(),
  }),
}))

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { PublicBottomBar } from '../../components/PublicBottomBar'

/* isCustomersPwa() legge window.location.pathname, che in jsdom e' '/': la
   variante PWA si ottiene spostando la history su un path /customers/... . */
const setPath = (path: string) => window.history.pushState({}, '', path)

const renderBar = () =>
  render(
    <MemoryRouter>
      <PublicBottomBar />
    </MemoryRouter>,
  )

describe('PublicBottomBar in PWA clienti', () => {
  beforeEach(() => {
    localStorage.clear()
    setPath('/customers/')
  })

  it('il tab profilo porta alla pagina profilo della PWA', () => {
    renderBar()
    const profile = screen.getByRole('link', { name: /profilo/i })
    expect(profile).toHaveAttribute('href', '/profilo')
  })

  it('non mostra il tab QR (rotta /admin/dashboard assente nella PWA)', () => {
    renderBar()
    expect(screen.queryByText('QR')).toBeNull()
  })

  it('non mostra il menu utente con "Modalità operatore"', async () => {
    renderBar()
    /* Nella PWA il tab profilo e' un link: non esiste il bottone che apre il
       menu della web app, quindi "Modalità operatore" non e' nemmeno
       raggiungibile. */
    expect(screen.queryByRole('button', { name: /profilo/i })).toBeNull()
    expect(screen.queryByText('Modalità operatore')).toBeNull()
  })
})

describe('PublicBottomBar nel sito operatore', () => {
  beforeEach(() => {
    localStorage.clear()
    setPath('/')
  })

  it('mostra il tab QR verso la dashboard operatore', () => {
    renderBar()
    expect(screen.getByText('QR').closest('a')).toHaveAttribute('href', '/admin/dashboard')
  })

  it('il tab profilo apre il menu utente con "Modalità operatore"', async () => {
    renderBar()
    await userEvent.click(screen.getByRole('button', { name: /profilo/i }))
    expect(screen.getByText('Modalità operatore')).toBeInTheDocument()
  })
})
