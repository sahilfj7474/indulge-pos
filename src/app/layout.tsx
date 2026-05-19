import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/lib/auth/context'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'Indulge POS',
  description: 'Point of Sale System',
  icons: {
    icon: '/logo-black.png',
    apple: '/logo-black.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AuthProvider>
          {children}
          <Toaster position="top-right" />
        </AuthProvider>
      </body>
    </html>
  )
}
