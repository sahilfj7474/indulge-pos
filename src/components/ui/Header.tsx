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
    <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6">
      <div />
      <div className="flex items-center gap-4 text-sm text-gray-400">
        <span>{formatDateTime(now)}</span>
        {user && (
          <span className="text-gray-500">
            Logged in as <span className="text-white">{user.full_name}</span>
          </span>
        )}
      </div>
    </header>
  )
}
