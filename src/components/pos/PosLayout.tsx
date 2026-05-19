'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/lib/auth/context'
import { getLocations } from '@/lib/services/admin.service'
import { Location } from '@/types'
import { ActiveLocationContext } from '@/lib/context/active-location'
import Sidebar from '@/components/ui/Sidebar'
import Header from '@/components/ui/Header'
import { MapPin, CheckCircle2 } from 'lucide-react'

const SESSION_KEY = 'indulge_pos_location'

export default function PosLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [locationId, setLocationIdState] = useState('')
  const [locations, setLocations]        = useState<Location[]>([])
  const [showPicker, setShowPicker]      = useState(false)
  const [loadingLocs, setLoadingLocs]    = useState(false)

  useEffect(() => {
    if (!user) return

    // Always fetch all locations (we need the Location object for receipts)
    setLoadingLocs(true)
    getLocations().then(locs => {
      const active = locs.filter(l => l.is_active !== false)
      setLocations(active)
      setLoadingLocs(false)

      if (user.location_id) {
        // Fixed primary location — use it
        setLocationIdState(user.location_id)
      } else {
        // Admin / manager with no primary — try session storage
        const stored = sessionStorage.getItem(SESSION_KEY)
        if (stored && active.some(l => l.id === stored)) {
          setLocationIdState(stored)
        } else {
          setShowPicker(true)
        }
      }
    })
  }, [user])

  function handleSelect(id: string) {
    sessionStorage.setItem(SESSION_KEY, id)
    setLocationIdState(id)
    setShowPicker(false)
  }

  // Resolve the full Location object matching the current locationId
  const location = useMemo(
    () => locations.find(l => l.id === locationId) ?? user?.location ?? null,
    [locations, locationId, user]
  )

  return (
    <ActiveLocationContext.Provider value={{ locationId, location, setLocationId: handleSelect }}>
      <div className="flex h-screen bg-blue-50 text-slate-900 overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>

      {/* ── Location picker overlay ── */}
      {showPicker && (
        <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <div className="bg-white border border-blue-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-blue-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <MapPin size={18} className="text-blue-600" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Select Operating Location</h2>
                  <p className="text-xs text-slate-500">Choose which store you're working at today</p>
                </div>
              </div>
            </div>

            {/* Location list */}
            <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
              {loadingLocs ? (
                <p className="text-center py-8 text-slate-400 text-sm">Loading locations...</p>
              ) : locations.length === 0 ? (
                <p className="text-center py-8 text-slate-400 text-sm">
                  No active locations found. Add one in Admin → Locations.
                </p>
              ) : locations.map(loc => (
                <button
                  key={loc.id}
                  onClick={() => handleSelect(loc.id)}
                  className="w-full flex items-center justify-between px-4 py-3.5 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 border border-blue-200 hover:border-blue-400 rounded-xl text-left transition-all group"
                >
                  <div>
                    <p className="font-semibold text-slate-800 group-hover:text-blue-700 text-sm">{loc.name}</p>
                    {loc.address && <p className="text-xs text-slate-400 mt-0.5">{loc.address}</p>}
                  </div>
                  <CheckCircle2 size={18} className="text-blue-300 group-hover:text-blue-500 shrink-0 transition-colors" />
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 pb-5">
              <p className="text-xs text-slate-400 text-center">
                Remembered for this browser session.
              </p>
            </div>
          </div>
        </div>
      )}
    </ActiveLocationContext.Provider>
  )
}
