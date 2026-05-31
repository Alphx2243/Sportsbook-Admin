'use client'

import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Shield, Trash2, User as UserIcon,
  ShieldAlert, Loader2, Calendar, Plus,
  X, Mail, Phone, UserPlus, Hash, Key
} from 'lucide-react'
import { getAllUsers, updateUserRole, deleteUser, createUser } from '@/actions/admin'
import { User } from '@/types/interfaces'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useAuth } from '@/contexts/AuthContext'


export default function UsersManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [loggedIn, checkloggedIn] = useState<Boolean>(true);
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newUserData, setNewUserData] = useState({
    name: '',
    email: '',
    phone: '',
    rollNumber: '',
    password: '',
    role: 'user'
  })
  const [isCreating, setIsCreating] = useState(false)
  const { user, loading: UserLoading } = useAuth();
  const isLoggedIn = () => {
    if(!user || user.role !== "Admin") checkloggedIn(false);
  }
  useEffect(() => {
    fetchUsers()
    isLoggedIn()
  }, [])

  const fetchUsers = async () => {
    const res = await getAllUsers()
    if (res.success) setUsers(res.data)
    setLoading(false)
  }
  const handlePromote = async (userId : string) => {
    console.log("userid: ", userId);
    const newRole = "Admin";
    const res = await updateUserRole(userId, newRole)
    if(res.success){
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u))
    }
  }


  const handleDelete = async (userId: string) => {
    if (!confirm('Are you sure you want to terminate this account? This action is permanent and all associated data will be purged.')) return
    setProcessingId(userId)
    const res = await deleteUser(userId)
    if (res.success) {
      setUsers(users.filter(u => u.id !== userId))
    } else {
      alert(`Deletion failed: ${res.error}`)
    }
    setProcessingId(null)
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreating(true)
    const res = await createUser(newUserData)
    if (res.success) {
      setUsers([res.data, ...users])
      setIsModalOpen(false)
      setNewUserData({
        name: '',
        email: '',
        phone: '',
        rollNumber: '',
        password: '',
        role: 'user'
      })
    } else {
      alert(res.error)
    }
    setIsCreating(false)
  }

  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.rollNumber?.toLowerCase().includes(search.toLowerCase())
  )
  if(loggedIn === false){
    throw new Error("Not Authorized");
  }
  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-6">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
        <p className="text-muted-foreground font-bold tracking-widest text-xs uppercase opacity-50">Loading Users...</p>
      </div>
    )
  }

  return (
    <div className="space-y-16 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-10">
        <div className="max-w-xl">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-500 text-xs font-bold uppercase tracking-widest border border-blue-500/20">
              User data
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground pb-1 leading-none">Users</h1>
          <p className="text-muted-foreground mt-1 text-xl font-medium opacity-80 leading-relaxed">
            Manage users
          </p>
        </div>

        <div className="flex items-center gap-6">
          <div className="relative w-full md:w-[350px] group">
            <div className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/40 group-focus-within:text-primary transition-all duration-300">
              <Search className="w-full h-full" />
            </div>
            <Input
              placeholder="Search users..."
              className="pl-14 pr-4 py-6 bg-background border-input rounded-xl focus:border-primary/50 transition-all font-medium text-base shadow-sm"
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            />
          </div>
          <Button
            onClick={() => setIsModalOpen(true)}
            className="px-6 py-6 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold shadow-sm transition-all h-[48px]"
          >
            <Plus className="w-5 h-5 mr-2" /> Create New User
          </Button>
        </div>
      </header>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-10">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-2xl bg-card border border-border rounded-3xl shadow-lg overflow-hidden"
            >
              <div className="p-8 md:p-10">
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <h2 className="text-3xl font-bold">Create New User</h2>
                    <p className="text-muted-foreground text-sm font-medium mt-2">Create a new user account with basic details.</p>
                  </div>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="w-12 h-12 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <form onSubmit={handleCreateUser} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground ml-1">Full Name</label>
                      <div className="relative">
                        <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          required
                          className="pl-11 py-5 rounded-xl bg-background border-input focus:border-primary/50 text-base"
                          placeholder="John Carter"
                          value={newUserData.name}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewUserData({ ...newUserData, name: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground ml-1">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          required
                          type="email"
                          className="pl-11 py-5 rounded-xl bg-background border-input focus:border-primary/50 text-base"
                          placeholder="john@iiitd.ac.in"
                          value={newUserData.email}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewUserData({ ...newUserData, email: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground ml-1">Phone Number</label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          required
                          className="pl-11 py-5 rounded-xl bg-background border-input focus:border-primary/50 text-base"
                          placeholder="+91 9876543210"
                          value={newUserData.phone}
                          
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewUserData({ ...newUserData, phone: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground ml-1">Roll Number</label>
                      <div className="relative">
                        <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          required
                          className="pl-11 py-5 rounded-xl bg-background border-input focus:border-primary/50 text-base"
                          placeholder="2024101"
                          value={newUserData.rollNumber}
                          
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewUserData({ ...newUserData, rollNumber: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground ml-1">Initial Password</label>
                    <div className="relative">
                      <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        required
                        type="password"
                        className="pl-11 py-5 rounded-xl bg-background border-input focus:border-primary/50 text-base"
                        placeholder="••••••••"
                        value={newUserData.password}
                        
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewUserData({ ...newUserData, password: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="pt-4">
                    <Button
                      type="submit"
                      disabled={isCreating}
                      className="w-full py-6 rounded-xl font-semibold bg-primary hover:bg-primary/90 text-white shadow-sm"
                    >
                      {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : <><UserPlus className="w-5 h-5 mr-2" /> Create User</>}
                    </Button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-8">
        <AnimatePresence mode="popLayout">
          {filteredUsers.map((u, i) => (
            <motion.div
              key={u.id}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              transition={{ duration: 0.4, delay: i * 0.03, type: 'spring', damping: 20 }}
            >
              <Card className="bg-card border-border rounded-2xl overflow-hidden group hover:border-primary/30 transition-all duration-300 hover:shadow-md">
                <CardContent className="p-6 md:p-8">
                  <div className="flex flex-col lg:flex-row items-center gap-6">
                    <div className="flex items-center gap-6 flex-1 min-w-0">
                      <div className={`w-16 h-16 rounded-xl flex items-center justify-center border transition-all duration-300 ${u.role === 'Admin' ? 'bg-primary/100 border-primary/20 text-primary shadow-sm' : 'bg-primary/100 border-border text-primary-foreground'}`}>
                        <UserIcon className="w-8 h-8" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-2xl font-bold truncate">{u.name}</h3>
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase shadow-sm ${u.role === 'Admin' ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-primary text-primary-foreground border border-border'}`}>
                            {u.role}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2">
                          <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <span className="text-xs font-bold text-muted-foreground/60 w-10">Email</span> {u.email}
                          </p>
                          <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <span className="text-xs font-bold text-muted-foreground/60 w-8">Roll</span> {u.rollNumber}
                          </p>
                          <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <span className="text-xs font-bold text-muted-foreground/60 w-12">Joined</span> {new Date(u.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 w-full lg:w-auto pt-6 lg:pt-0 border-t lg:border-t-0 border-border">
                      {
                        u.role !== "Admin" ? (
                          <Button
                            size="sm"
                            onClick={() => handlePromote(u.id)}
                          >
                            <p>Promote</p>
                        </Button>
                        ) : (
                          <></>
                        )
                      }
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-12 h-12 rounded-lg hover:bg-destructive/10 hover:text-destructive group/del border border-border hover:border-destructive/20 transition-all duration-200 bg-background"
                        onClick={() => handleDelete(u.id)}
                        disabled={processingId === u.id}
                      >
                        <Trash2 className="w-5 h-5 transition-transform" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredUsers.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-40 border border-border border-dashed rounded-2xl bg-secondary/5"
          >
            <div className="w-20 h-20 bg-background border border-border rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 shadow-sm">
              <Search className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-2xl font-bold">No Users Found</h3>
            <p className="text-muted-foreground text-sm font-medium mt-2">Search yields zero matches.</p>
          </motion.div>
        )}
      </div>
    </div>
  )
}
