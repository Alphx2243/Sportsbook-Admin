'use client'

import { useState } from 'react'
import { Moon, Sun, AlignRight, X, LogOut } from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import LogoutModal from './ui/LogoutModal'
import { getAdminNavLinks } from '@/lib/roles'

export default function Navbar() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()

  const [mobileOpen, setMobileOpen] = useState(false)
  const [logoutModalOpen, setLogoutModalOpen] = useState(false)

  const adminLinks = getAdminNavLinks(user?.role)

  const toggleMobile = () => {
    setMobileOpen(o => !o)
  }

  const handleLogout = async () => {
    await logout()
    setLogoutModalOpen(false)
    window.location.href = '/'
  }

  return (
    <nav className="fixed inset-x-0 top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-white/10 dark:border-white/10 border-black/5 shadow-lg">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <Link href="/" className="text-2xl font-bold text-gradient-premium tracking-tighter">
              SB Admin
            </Link>
            <div className="hidden md:flex ml-10 space-x-6 items-center">
              {adminLinks.map(link => (
                <Link
                  key={link.path}
                  href={link.path}
                  className="px-3 py-2 cursor-pointer rounded-md text-sm font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-200"
                >
                  {link.name}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full border border-white/10 dark:border-white/10 border-black/5 bg-white/5 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              {theme === 'dark' ? <Moon className="w-5 h-5 text-blue-200" /> : <Sun className="w-5 h-5 text-yellow-500" />}
            </button>
            
            {user && (
              <button
                onClick={() => setLogoutModalOpen(true)}
                className="hidden md:flex h-10 items-center gap-2 px-3 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all duration-300 cursor-pointer font-semibold text-sm"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
                <span>Logout</span>
              </button>
            )}
            <button
              onClick={toggleMobile}
              className="md:hidden p-2 rounded-md focus:outline-none text-foreground hover:bg-white/10"
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <AlignRight className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden glass-panel border-t border-white/10 overflow-hidden"
          >
            <div className="px-4 pt-4 pb-6 space-y-2 max-h-[calc(100vh-5rem)] overflow-y-auto custom-scrollbar">
              {adminLinks.map(link => (
                <Link
                  key={link.path}
                  href={link.path}
                  onClick={() => setMobileOpen(false)}
                  className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-muted-foreground hover:text-primary hover:bg-primary/10"
                >
                  {link.name}
                </Link>
              ))}
              
              {user && (
                <button
                  onClick={() => setLogoutModalOpen(true)}
                  className="mt-4 flex w-full items-center justify-center gap-2 px-3 py-3 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all duration-300 cursor-pointer font-bold"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <LogoutModal
        isOpen={logoutModalOpen}
        onClose={() => setLogoutModalOpen(false)}
        onConfirm={handleLogout}
      />
    </nav>
  )
}
