import { useMemo, useState, useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import { AdminSidebar } from './AdminSidebar'
import { AdminTopBar } from './AdminTopBar'
import { AdminEventContext, type AdminEventContextValue } from './AdminEventContext'
import styles from './AdminLayout.module.scss'

const EVENT_STORAGE_KEY = 'adminSelectedEventId'

export function AdminLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const [events, setEvents] = useState<AdminEventContextValue['events']>([])
  const [manuallySelectedEventId, setManuallySelectedEventId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(EVENT_STORAGE_KEY)
    } catch {
      return null
    }
  })
  const [now] = useState(() => Date.now())

  useEffect(() => {
    apiRequest<{ items: AdminEventContextValue['events'] }>('/events')
      .then((d) => setEvents(d.items))
      .catch(() => {})
  }, [])

  const urlEventId = location.pathname.match(/^\/admin\/events\/([a-f0-9]{24})(?:\/|$)/)?.[1] ?? null
  const storedEventId =
    manuallySelectedEventId && events.some((ev) => ev.id === manuallySelectedEventId)
      ? manuallySelectedEventId
      : null
  const defaultEventId = useMemo(() => {
    if (events.length === 0) return null
    const ongoing = events.find((ev) => {
      if (!ev.endDate) return false
      const endOfDay = new Date(ev.endDate)
      endOfDay.setHours(23, 59, 59, 999)
      return endOfDay.getTime() >= now
    })
    return (ongoing ?? events[0]).id
  }, [events, now])

  const selectedEventId = urlEventId ?? storedEventId ?? defaultEventId
  const selectedEvent = events.find((ev) => ev.id === selectedEventId) ?? null

  const handleSelectEvent = (eventId: string) => {
    if (!eventId) return
    setManuallySelectedEventId(eventId)
    try {
      localStorage.setItem(EVENT_STORAGE_KEY, eventId)
    } catch { /* storage non disponibile */ }
    if (eventId !== selectedEventId) {
      navigate('/admin/dashboard')
    }
  }

  const contextValue = useMemo<AdminEventContextValue>(
    () => ({ selectedEventId, selectedEvent, events }),
    [selectedEventId, selectedEvent, events],
  )

  const isSlideshow = location.pathname.includes('/slideshow')
  const isCashier = /\/stands\/[^/]+\/order$/.test(location.pathname) || /\/cashier/.test(location.pathname)
  const isOrdersQueue = /\/ordersqueue/.test(location.pathname)
  const isStationQueue = /\/orders\/station\//.test(location.pathname)
  const isExchange = /\/events\/[^/]+\/exchange/.test(location.pathname)

  const hideChrome = isSlideshow || isCashier || isOrdersQueue || isStationQueue || isExchange

  return (
    <AdminEventContext.Provider value={contextValue}>
      <div className={styles.admin}>
        {!hideChrome && (
          <AdminSidebar
            isMobileOpen={isMobileMenuOpen}
            onMobileClose={() => setIsMobileMenuOpen(false)}
            onSelectEvent={handleSelectEvent}
          />
        )}

        <div className={styles.main} data-hide-chrome={hideChrome || undefined}>
          {!hideChrome && (
            <AdminTopBar onMenuToggle={() => setIsMobileMenuOpen((v) => !v)} />
          )}

          <div className={styles.content} data-fullbleed={hideChrome || undefined}>
            {hideChrome ? (
              <Outlet />
            ) : (
              <div className="page-shell">
                <Outlet />
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminEventContext.Provider>
  )
}
