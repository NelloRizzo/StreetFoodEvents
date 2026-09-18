import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'

import { ThemeProvider } from './features/theme/ThemeProvider'
import { AuthProvider } from './features/auth/auth-context'
import { customerRouter } from './customer-router'
import { CustomerPwaPrompt } from './components/CustomerPwaPrompt'
import './styles/global.scss'

/* Customers PWA entry — public app shell (installable, offline-able).
   Served at /customers/. NO admin/cashier/station routes (see customer-router). */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <RouterProvider router={customerRouter} />
        <CustomerPwaPrompt />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
