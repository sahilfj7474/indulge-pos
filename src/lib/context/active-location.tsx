'use client'

import { createContext, useContext } from 'react'
import { Location } from '@/types'

export interface ActiveLocationCtx {
  /** Resolved location ID for this POS session (never empty once the user has picked) */
  locationId: string
  /** Full Location object matching locationId (null until resolved) */
  location: Location | null
  /** Call this from the location picker to commit a choice */
  setLocationId: (id: string) => void
}

export const ActiveLocationContext = createContext<ActiveLocationCtx>({
  locationId: '',
  location: null,
  setLocationId: () => {},
})

export const useActiveLocation = () => useContext(ActiveLocationContext)
