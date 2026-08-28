import { createContext, useContext } from 'react'

export type AdminEventItem = { id: string; name: string; endDate?: string | null }

export type AdminEventContextValue = {
  selectedEventId: string | null
  selectedEvent: AdminEventItem | null
  events: AdminEventItem[]
}

export const AdminEventContext = createContext<AdminEventContextValue>({
  selectedEventId: null,
  selectedEvent: null,
  events: [],
})

export function useAdminEvent() {
  return useContext(AdminEventContext)
}
