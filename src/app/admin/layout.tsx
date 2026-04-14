'use client'

import React, { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (!user || user.role !== 'Admin') {
        router.push('/login')
      }
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="relative">
            <Loader2 className="w-16 h-16 text-primary animate-spin" />
            <div className="absolute inset-0 bg-primary/20 blur-xl animate-pulse rounded-full" />
          </div>
        </div>
      </div>
    )
  }

  if (!user || user.role !== 'Admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground font-bold italic">Redirecting to login...</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground antialiased pt-16">
      <main className="flex-1 relative z-10 w-full min-w-0">
        <div className="max-w-7xl mx-auto p-6 md:p-10 lg:p-10">
          {children}
        </div>
      </main>
    </div>
  )
}
