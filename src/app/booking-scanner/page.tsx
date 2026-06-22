'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
    CheckCircle2,
    AlertCircle, Loader2, Camera, Info,
    QrCode, Upload
} from 'lucide-react'
import { Html5Qrcode } from 'html5-qrcode'
import { activateBooking } from '@/actions/bookings'

export default function BookingScannerPage() {
    const [isScanning, setIsScanning] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [result, setResult] = useState<any>(null)
    const [error, setError] = useState('')
    const scannerRef = useRef<Html5Qrcode | null>(null)
    const [manualId, setManualId] = useState('')
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        return () => {
            if (scannerRef.current && scannerRef.current.isScanning) {
                scannerRef.current.stop()
            }
        }
    }, [])

    const startScanner = async () => {
        setIsScanning(true)
        setError('')
        setResult(null)

        setTimeout(() => {
            const scanner = new Html5Qrcode("reader")
            scannerRef.current = scanner
            scanner.start(
                { facingMode: "environment" },
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 }
                },
                onScanSuccess,
                onScanFailure
            ).catch(err => {
                console.error("Scanner start error:", err)
                setError("Could not access camera. Please check permissions.")
                setIsScanning(false)
            })
        }, 100)
    }

    const stopScanner = async () => {
        if (scannerRef.current && scannerRef.current.isScanning) {
             try {
                await scannerRef.current.stop()
            } catch (err) {
                console.error("Scanner stop error:", err)
            }
        }
        setIsScanning(false)
    }

    const onScanSuccess = async (decodedText: string) => {
        await stopScanner()
        processScannedData(decodedText)
    }

    const onScanFailure = (error: string) => {
    }

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        setIsProcessing(true)
        setError('')
        setResult(null)

        const html5QrCode = new Html5Qrcode("reader-hidden")
        try {
            const decodedText = await html5QrCode.scanFile(file, true)
            processScannedData(decodedText)
        } catch (err) {
            console.error("QR Upload Error:", err)
            setError("Could not find a valid QR code in this image. Please try another one.")
        } finally {
            setIsProcessing(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const processScannedData = async (data: string) => {
        setIsProcessing(true)
        setError('')
        try {
            let bookingId = data
            
            try {
                const parsed = JSON.parse(data)
                if (parsed.bookingId) bookingId = parsed.bookingId
            } catch (e) {
            }

            const res = await activateBooking(bookingId)
            if (res.success) {
                setResult(res.data)
                setManualId('')
            } else {
                setError(res.error || 'Failed to activate booking')
            }
        } catch (err) {
            setError('An unexpected error occurred')
            console.error(err)
        } finally {
            setIsProcessing(false)
        }
    }

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (manualId.trim()) {
            processScannedData(manualId.trim())
        }
    }

    return (
        <main className="min-h-screen bg-background text-foreground py-24 px-6 md:px-12">
            <div className="max-w-4xl mx-auto">
                <header className="text-center mb-16">
                    <motion.div 
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="inline-flex items-center justify-center p-4 bg-primary/10 rounded-3xl mb-6 border border-primary/20 shadow-[0_0_30px_-5px_var(--color-primary)]"
                    >
                        <QrCode className="text-primary w-12 h-12" />
                    </motion.div>
                    <h1 className="text-5xl font-black text-gradient-premium tracking-tighter mb-4 italic text-gradient">
                        Booking Activator
                    </h1>
                    <p className="text-gray-400 text-lg font-medium max-w-2xl mx-auto">
                        Scan player QR codes to start their session timers and track attendance.
                    </p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
                    <motion.div 
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        className="glass-panel p-2 rounded-[2rem] border border-white/10 shadow-3xl overflow-hidden aspect-square relative group"
                    >
                        {!isScanning ? (
                            <div className="flex flex-col items-center justify-center h-full space-y-6">
                                <div className="p-8 rounded-full bg-white/5 border border-white/10 group-hover:scale-110 transition-transform duration-500">
                                    <Camera className="w-16 h-16 text-primary/40" />
                                </div>
                                <button 
                                    onClick={startScanner}
                                    className="px-8 py-4 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/30 hover:shadow-primary/50 hover:scale-105 active:scale-95 transition-all text-sm uppercase tracking-widest"
                                >
                                    Activate Camera
                                </button>
                                <div className="flex flex-col items-center gap-2">
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex items-center gap-2 text-primary/60 hover:text-primary transition-colors text-xs font-bold uppercase tracking-widest"
                                    >
                                        <Upload className="w-4 h-4" />
                                        Upload QR Image
                                    </button>
                                    <input 
                                        type="file" 
                                        ref={fileInputRef}
                                        onChange={handleFileUpload}
                                        accept="image/*"
                                        className="hidden"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="relative w-full h-full rounded-[1.8rem] overflow-hidden bg-black">
                                <div id="reader" className="w-full h-full"></div>
                                <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none">
                                    <div className="w-full h-full border-2 border-primary animate-pulse rounded-lg shadow-[0_0_30px_var(--color-primary)]" />
                                </div>
                                <button 
                                    onClick={stopScanner}
                                    className="absolute bottom-6 left-1/2 -translate-x-1/2 px-6 py-2 bg-red-500 text-white text-xs font-bold rounded-full shadow-lg"
                                >
                                    Cancel Scan
                                </button>
                            </div>
                        )}
                    </motion.div>

                    <div className="space-y-8">
                        <motion.div 
                            initial={{ x: 20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            className="glass-panel p-8 rounded-3xl border border-white/10 shadow-2xl"
                        >
                            <h3 className="text-xl font-bold flex items-center gap-3 mb-6">
                                <Info className="w-5 h-5 text-primary" />
                                Manual Entry
                            </h3>
                            <form onSubmit={handleManualSubmit} className="space-y-4">
                                <div className="relative">
                                    <QrCode className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
                                    <input 
                                        type="text" 
                                        value={manualId}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setManualId(e.target.value)}
                                        placeholder="Enter Booking ID manually..."
                                        className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold"
                                    />
                                </div>
                                <button 
                                    disabled={isProcessing || !manualId.trim()}
                                    className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-foreground font-black rounded-2xl transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
                                >
                                    {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Process ID'}
                                </button>
                            </form>
                        </motion.div>

                        <AnimatePresence mode="wait">
                            {error && (
                                <motion.div 
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="p-6 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center gap-4 text-red-400"
                                >
                                    <AlertCircle className="w-6 h-6 shrink-0" />
                                    <p className="font-bold text-sm">{error}</p>
                                </motion.div>
                            )}

                            {result && (
                                <motion.div 
                                    initial={{ height: 0, opacity: 0, scale: 0.9 }}
                                    animate={{ height: 'auto', opacity: 1, scale: 1 }}
                                    className="bg-green-500/10 border border-green-500/20 rounded-3xl p-8 shadow-2xl relative overflow-hidden"
                                >
                                    <div className="absolute -right-8 -top-8 opacity-5">
                                        <CheckCircle2 className="w-32 h-32 text-green-500" />
                                    </div>
                                    
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="p-3 bg-green-500/20 rounded-2xl text-green-400">
                                            <CheckCircle2 className="w-8 h-8" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-white italic">Activation Success!</h3>
                                            <p className="text-green-500/60 text-xs font-bold uppercase tracking-widest">Session Started</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4 relative z-10">
                                        <div className="flex justify-between items-center py-3 border-b border-white/5">
                                            <span className="text-gray-400 text-xs font-bold uppercase tracking-widest">Sport</span>
                                            <span className="font-black text-white">{result.sportName}</span>
                                        </div>
                                        <div className="flex justify-between items-center py-3 border-b border-white/5">
                                            <span className="text-gray-400 text-xs font-bold uppercase tracking-widest">Court</span>
                                            <span className="font-black text-primary">#{result.courtNo}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 pt-2">
                                            <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                                <p className="text-gray-500 text-[10px] uppercase font-black mb-1">Start</p>
                                                <p className="font-bold text-lg">{result.startTime}</p>
                                            </div>
                                            <div className="p-4 bg-primary/20 rounded-2xl border border-primary/20">
                                                <p className="text-primary/60 text-[10px] uppercase font-black mb-1">End</p>
                                                <p className="font-bold text-lg text-primary">{result.endTime}</p>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
            <div id="reader-hidden" className="hidden"></div>
        </main>
    )
}
