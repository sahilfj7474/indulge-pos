'use client'

import { useAuth } from '@/lib/auth/context'
import { formatDateTime } from '@/lib/utils'
import { useEffect, useState } from 'react'

export default function Header() {
  const { user } = useAuth()
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <header className="h-14 bg-white border-b border-blue-100 flex items-center justify-between px-6 shadow-sm">
      <img
        src="/logo-black.png"
        alt="Indulge POS"
        className="h-8 w-auto object-contain"
      />
      <div className="flex items-center gap-4 text-sm text-slate-500">
        <span>{formatDateTime(now)}</span>
        {user && (
          <span>
            Logged in as <span className="text-slate-800 font-medium">{user.full_name}</span>
          </span>
        )}
      </div>
    </header>
  )
}
