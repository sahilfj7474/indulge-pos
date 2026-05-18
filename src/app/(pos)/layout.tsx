import Sidebar from '@/components/ui/Sidebar'
import Header from '@/components/ui/Header'

export default function POSLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-blue-50 text-slate-900 overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
