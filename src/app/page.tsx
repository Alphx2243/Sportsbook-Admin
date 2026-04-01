'use client'

import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (!user || user.role !== 'Admin') {
        router.push('/login')
      } else {
        router.push('/admin')
      }
    }
  }, [user, loading, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="relative">
          <Loader2 className="w-16 h-16 text-primary animate-spin" />
          <div className="absolute inset-0 bg-primary/20 blur-xl animate-pulse rounded-full" />
        </div>
        <p className="text-muted-foreground font-medium animate-pulse text-sm">Initializing Portal...</p>
      </div>
    </div>
  )
}
