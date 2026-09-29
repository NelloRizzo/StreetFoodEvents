import { describe, expect, it, vi } from 'vitest'

import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { ProfilePage } from '../../pages/ProfilePage'
import type { AuthUser } from '../../features/auth/auth-context'

const authState = {
  isAuthenticated: true,
  user: null as AuthUser | null,
  logout: vi.fn(async () => {
    authState.isAuthenticated = false
    authState.user = null
  }),
}

vi.mock('../../features/auth/auth-context', () => ({
  useAuth: () => authState,
}))

const renderProfile = () =>
  render(
    <MemoryRouter initialEntries={['/profilo']}>
      <Routes>
        <Route path="/profilo" element={<ProfilePage />} />
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>,
  )

const admin: AuthUser = {
  id: 'u1',
  firstName: 'Ada',
  lastName: 'Admin',
  email: 'ada@example.com',
  avatar: null,
  isAdmin: true,
}

const customer: AuthUser = {
  id: 'u2',
  firstName: 'Carla',
  lastName: 'Cliente',
  email: 'carla@example.com',
  avatar: null,
}

describe('ProfilePage', () => {
  it('shows the user data and the menu entries for an authenticated admin', () => {
    authState.isAuthenticated = true
    authState.user = admin
    renderProfile()

    expect(screen.getByText('Ada Admin')).toBeTruthy()
    expect(screen.getByText('ada@example.com')).toBeTruthy()
    // un admin vede il badge, ma nessun rimando alla dashboard operatore
    expect(screen.getByText('Amministratore')).toBeTruthy()
    expect(screen.queryByText(/operatore/i)).toBeNull()

    expect(screen.getByText('Preferiti')).toBeTruthy()
    expect(screen.getByText('Privacy Policy')).toBeTruthy()
    expect(screen.getByText('Esci')).toBeTruthy()
    // le guide sono manuali operativi (cassa unica, ordini, sidebar admin):
    // dal profilo cliente non devono essere raggiungibili
    expect(screen.queryByText('Guide')).toBeNull()
  })

  it('hides the admin badge for a regular customer', () => {
    authState.isAuthenticated = true
    authState.user = customer
    renderProfile()

    expect(screen.getByText('Carla Cliente')).toBeTruthy()
    expect(screen.queryByText('Amministratore')).toBeNull()
  })

  it('offers login/register to anonymous visitors instead of the menu', () => {
    authState.isAuthenticated = false
    authState.user = null
    renderProfile()

    expect(screen.getByText(/Accedi al tuo profilo/)).toBeTruthy()
    expect(screen.getByText('Accedi')).toBeTruthy()
    expect(screen.getByText('Crea un account')).toBeTruthy()
    expect(screen.queryByText('Esci')).toBeNull()
  })
})
