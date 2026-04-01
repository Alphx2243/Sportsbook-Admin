'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Clock, MapPin, Package, User, Loader2, AlertCircle } from 'lucide-react'
import { getBookings, expireBooking } from '@/actions/bookings'
import Button from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'

export default function AdminBookingsPage() {
    const { user, loading: authLoading } = useAuth()
    const router = useRouter()
    const [bookings, setBookings] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [processingId, setProcessingId] = useState<string | null>(null)

    const fetchPendingReturns = async () => {
        try {
            const res = await getBookings({ status: 'returned' })
            if (res.success) {
                setBookings(res.data.documents)
            }
        } catch (err) {
            console.error('Error fetching pending returns:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (!authLoading) {
            if (!user || user.role !== 'Admin') {
                router.push('/')
                return
            }
            fetchPendingReturns()
        }
    }, [user, authLoading, router])

    const handleApprove = async (bookingId: string) => {
        setProcessingId(bookingId)
        try {
            const res = await expireBooking(bookingId)
            if (res.success) {
                setBookings(bookings.filter(b => b.id !== bookingId))
            } else {
                alert(res.error || 'Failed to approve return')
            }
        } catch (err) {
            console.error('Approval error:', err)
        } finally {
            setProcessingId(null)
        }
    }

    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </div>
        )
    }

    return (
        <main className="min-h-screen bg-background text-foreground py-24 px-6 md:px-12">
            <div className="max-w-6xl mx-auto">
                <header className="mb-12">
                    <h1 className="text-4xl font-black text-gradient-premium tracking-tighter">Pending Returns</h1>
                    <p className="text-gray-400 mt-2 text-lg">Approve equipment returns and free up courts.</p>
                </header>

                <div className="grid grid-cols-1 gap-6">
                    <AnimatePresence mode="popLayout">
                        {bookings.length > 0 ? (
                            bookings.map((booking, idx) => (
                                <motion.div
                                    key={booking.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ duration: 0.3, delay: idx * 0.05 }}
                                >
                                    <Card className="glass-panel border-white/5 overflow-hidden group">
                                        <CardContent className="p-8">
                                            <div className="flex flex-col lg:flex-row gap-8 items-start lg:items-center">
                                                <div className="flex-1 space-y-4">
                                                    <div className="flex items-center gap-3">
                                                        <span className="px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-500 text-[10px] font-black uppercase tracking-widest border border-yellow-500/20">
                                                            Pending Approval
                                                        </span>
                                                        <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">
                                                            ID: {booking.id.slice(0, 8)}
                                                        </span>
                                                    </div>

                                                    <h2 className="text-3xl font-black tracking-tighter group-hover:text-primary transition-colors">
                                                        {booking.sportName}
                                                        <span className="ml-3 text-primary/50 text-xl font-bold">Court {booking.courtNo}</span>
                                                    </h2>

                                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pt-2">
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">User</p>
                                                            <div className="flex items-center gap-2 text-foreground font-bold">
                                                                <User className="w-4 h-4 text-primary" />
                                                                {booking.user?.name || 'Unknown'}
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Session Time</p>
                                                            <div className="flex items-center gap-2 text-foreground font-bold">
                                                                <Clock className="w-4 h-4 text-primary" />
                                                                {booking.startTime} - {booking.endTime}
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Date</p>
                                                            <div className="flex items-center gap-2 text-foreground font-bold">
                                                                <Clock className="w-4 h-4 text-primary" />
                                                                {booking.date}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="pt-4 border-t border-white/5">
                                                        <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-3">Issued Equipment</p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {booking.issuedEquipments && booking.issuedEquipments.length > 0 ? (
                                                                booking.issuedEquipments.map((eq: string, i: number) => {
                                                                    const [name, count] = eq.split(':')
                                                                    return (
                                                                        <span key={i} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-bold flex items-center gap-2">
                                                                            <Package className="w-3 h-3 text-primary" />
                                                                            {name} <span className="text-primary font-black">x{count}</span>
                                                                        </span>
                                                                    )
                                                                })
                                                            ) : (
                                                                <span className="text-gray-600 text-xs italic">No equipment recorded</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="shrink-0 w-full lg:w-48">
                                                    <Button
                                                        variant="primary"
                                                        className="w-full py-6 text-sm font-black uppercase tracking-widest"
                                                        onClick={() => handleApprove(booking.id)}
                                                        disabled={processingId === booking.id}
                                                    >
                                                        {processingId === booking.id ? (
                                                            <Loader2 className="w-5 h-5 animate-spin" />
                                                        ) : (
                                                            <>
                                                                <CheckCircle2 className="w-5 h-5 mr-2" />
                                                                Approve Return
                                                            </>
                                                        )}
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))
                        ) : (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-center py-24 glass-panel border border-white/5 rounded-3xl"
                            >
                                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-primary/20">
                                    <CheckCircle2 className="w-10 h-10 text-primary" />
                                </div>
                                <h2 className="text-2xl font-bold mb-2">All Caught Up!</h2>
                                <p className="text-gray-500">No pending return requests at the moment.</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </main>
    )
}
