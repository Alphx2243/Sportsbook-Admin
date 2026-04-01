'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { ActionResponse } from '@/interfaces'

async function notifySocketUpdate(sportName: string, type: string = 'availability_changed') {
    const url = `${process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3005'}/notify-update`;
    console.log(`Notifying socket server at ${url} for sport: ${sportName} (Type: ${type})`);
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sportName, type }),
        });
        console.log(`Socket server response: ${response.status} ${response.statusText}`);
    } catch (error) {
        console.error('Failed to notify socket server:', error);
    }
}

export async function createBooking(data: any): Promise<ActionResponse> {
    try {
        const existingBooking = await prisma.booking.findFirst({
            where: {
                userId: data.userId,
                status: { in: ['pending', 'active', 'returned'] }
            }
        })

        if (existingBooking) {
            const msg = existingBooking.status === 'active'
                ? 'You already have an active booking.'
                : 'Your previous session return is pending admin approval.';
            return { success: false, error: `${msg} Please return items and wait for admin approval first.` }
        }

        const booking = await prisma.booking.create({
            data: {
                userId: data.userId, sportName: data.sportName,
                issuedEquipments: data.equipmentsIssued || [],
                numberOfPlayers: parseInt(data.numberOfPlayers || 0),
                startTime: data.startTime, endTime: data.endTime,
                date: data.date, qrDetail: data.qrdetail,
                status: data.status, endDate: data.enddate,
                courtNo: data.CourtNo,
            },
        })
        revalidatePath('/')
        return { success: true, data: booking }
    }
    catch (error: any) {
        console.error('Create booking error:', error)
        return { success: false, error: error.message || 'Failed to create booking' }
    }
}

export async function updateBooking(id: string, data: any): Promise<ActionResponse> {
    try {
        const booking = await prisma.booking.update({
            where: { id },
            data: {
                userId: data.userId, sportName: data.sportName,
                issuedEquipments: data.equipmentsIssued,
                numberOfPlayers: data.numberOfPlayers ? parseInt(data.numberOfPlayers) : undefined,
                startTime: data.startTime, endTime: data.endTime,
                scanned: data.scanned, qrDetail: data.qrdetail,
                status: data.status, endDate: data.enddate,
                courtNo: data.CourtNo,
            },
        })
        revalidatePath('/')
        return { success: true, data: booking }
    }
    catch (error: any) {
        console.error('Update booking error:', error)
        return { success: false, error: error.message || 'Failed to update booking' }
    }
}

export async function deleteBooking(id: string): Promise<ActionResponse> {
    try {
        await prisma.booking.delete({ where: { id }, })
        revalidatePath('/')
        return { success: true, data: null }
    }
    catch (error: any) {
        console.error('Delete booking error:', error)
        return { success: false, error: error.message || 'Failed to delete booking' }
    }
}

export async function getBooking(id: string): Promise<ActionResponse> {
    try {
        const booking = await prisma.booking.findUnique({ where: { id }, })
        if (!booking) return { success: false, error: 'Booking not found' }
        return { success: true, data: booking }
    }
    catch (error: any) {
        console.error('Get booking error:', error)
        return { success: false, error: error.message || 'Failed to get booking' }
    }
}

export async function getBookings(filters: { userId?: string; status?: string; date?: string; timeRange?: string } = {}): Promise<ActionResponse<{ documents: any[], total: number }>> {
    try {
        const where: any = {}
        if (filters.userId) where.userId = filters.userId
        if (filters.status) where.status = filters.status
        if (filters.date) where.date = filters.date
        if (filters.timeRange) {
            where.startTime = { lte: filters.timeRange }
            where.endTime = { gt: filters.timeRange }
        }
        const bookings = await prisma.booking.findMany({
            where, orderBy: { createdAt: 'desc' }, include: { user: true }
        })
        return { success: true, data: { documents: bookings, total: bookings.length } }
    }
    catch (error: any) {
        console.error('Get bookings error:', error)
        return { success: false, error: error.message || 'Failed to get bookings' }
    }
}

export async function extendBooking(bookingId: string, extensionMinutes: number): Promise<ActionResponse> {
    try {
        const updatedBooking = await prisma.$transaction(async (tx: any) => {
            
            const [booking]: any = await tx.$queryRaw`SELECT * FROM "Booking" WHERE "id" = ${bookingId} FOR UPDATE`;
            if (!booking) throw new Error('Booking not found');

            const originalStartDate = new Date(`${booking.date}T${booking.startTime}`);
            const currentEndDate = new Date(`${booking.endDate || booking.date}T${booking.endTime}`);
            const newEndDate = new Date(currentEndDate.getTime() + extensionMinutes * 60000);
            const totalDurationMs = newEndDate.getTime() - originalStartDate.getTime();
            const totalDurationMinutes = totalDurationMs / (1000 * 60);

            if (totalDurationMinutes > 240) {
                throw new Error('Total booking duration cannot exceed 4 hours');
            }

            const newEndTime = newEndDate.toTimeString().split(' ')[0];
            const newEndDateStr = newEndDate.toISOString().split('T')[0];

            return await tx.booking.update({
                where: { id: bookingId },
                data: { endTime: newEndTime, endDate: newEndDateStr }
            });
        });
        revalidatePath('/')
        return { success: true, data: updatedBooking }
    }
    catch (error: any) {
        console.error('Extend booking error:', error)
        return { success: false, error: error.message || 'Failed to extend booking' }
    }
}

export async function expireBooking(bookingId: string): Promise<ActionResponse> {
    try {
        await prisma.$transaction(async (tx: any) => {
            const [booking]: any = await tx.$queryRaw`SELECT * FROM "Booking" WHERE "id" = ${bookingId} FOR UPDATE`;
            if (!booking || (booking.status !== 'active' && booking.status !== 'returned')) {
                throw new Error('Booking not found or already inactive');
            }

            const [sportRow]: any = await tx.$queryRaw`SELECT * FROM "Sport" WHERE "name" = ${booking.sportName} FOR UPDATE`;
            if (!sportRow) {
                throw new Error('Associated Sport not found');
            }

            await tx.booking.update({
                where: { id: bookingId },
                data: { status: 'expired' }
            });

            const [sport]: any = await tx.$queryRaw`SELECT * FROM "Sport" WHERE "name" = ${booking.sportName} FOR UPDATE`;
            if (!sport) {
                throw new Error('Associated Sport not found');
            }

            
            const issuedEq = booking.issuedEquipments || [];
            let newEqInUse = [...(sport.equipmentsInUse || [])];
            issuedEq.forEach((issued: any) => {
                const [name, count] = issued.split(':');
                const issuedCount = parseInt(count);
                newEqInUse = newEqInUse.map((eq: any) => {
                    const [eqName, eqCount] = eq.split(':');
                    if (eqName === name) {
                        const currentVal = parseInt(eqCount);
                        return `${eqName}:${Math.max(0, currentVal - issuedCount)}`;
                    }
                    return eq;
                });
            });

            await tx.sport.update({
                where: { id: sport.id },
                data: {
                    equipmentsInUse: newEqInUse
                }
            });
        });
        revalidatePath('/')
        revalidatePath('/dashboard')
        revalidatePath('/book-court')

        
        const [bookingForSport]: any = await prisma.$queryRaw`SELECT "sportName" FROM "Booking" WHERE "id" = ${bookingId}`;
        if (bookingForSport) {
            await notifySocketUpdate(bookingForSport.sportName, 'booking_status_changed');
        }

        return { success: true, data: null }
    }
    catch (error: any) {
        console.error('Expire booking error:', error)
        return { success: false, error: error.message || 'Failed to expire booking' }
    }
}

export async function requestReturn(bookingId: string): Promise<ActionResponse> {
    try {
        await prisma.$transaction(async (tx: any) => {
            const [booking]: any = await tx.$queryRaw`SELECT * FROM "Booking" WHERE "id" = ${bookingId} FOR UPDATE`;
            if (!booking || booking.status !== 'active') {
                throw new Error('Booking not found or not active');
            }

            const [sport]: any = await tx.$queryRaw`SELECT * FROM "Sport" WHERE "name" = ${booking.sportName} FOR UPDATE`;
            if (!sport) {
                throw new Error('Associated Sport not found');
            }

            
            const courtNo = booking.courtNo;
            let newCourtData = sport.courtData || [];
            newCourtData = newCourtData.map((item: any, i: number) => {
                const targetIndex = parseInt(courtNo) - 1;
                if (i === targetIndex) {
                    const name = item.split(':')[0];
                    return `${name}:0`;
                }
                return item;
            });

            await tx.sport.update({
                where: { id: sport.id },
                data: {
                    courtsInUse: Math.max(0, (sport.courtsInUse || 0) - 1),
                    numPlayers: Math.max(0, (sport.numPlayers || 0) - (booking.numberOfPlayers || 0)),
                    courtData: newCourtData
                }
            });

            await tx.booking.update({
                where: { id: bookingId },
                data: { status: 'returned' }
            });
        });

        revalidatePath('/')
        revalidatePath('/dashboard')
        revalidatePath('/book-court')

        
        const [bookingForSport]: any = await prisma.$queryRaw`SELECT "sportName" FROM "Booking" WHERE "id" = ${bookingId}`;
        if (bookingForSport) {
            await notifySocketUpdate(bookingForSport.sportName, 'booking_status_changed');
        }

        return { success: true, data: null }
    }
    catch (error: any) {
        console.error('Request return error:', error)
        return { success: false, error: error.message || 'Failed to request return' }
    }
}

export async function secureBooking(data: any): Promise<ActionResponse> {
    try {
        const result = await prisma.$transaction(async (tx: any) => {
            const existingBooking = await tx.booking.findFirst({
                where: { userId: data.userId, status: { in: ['pending', 'active', 'returned'] } }
            })
            if (existingBooking) {
                const msg = existingBooking.status === 'active'
                    ? 'You already have an active booking.'
                    : 'Your previous session return is pending admin approval.';
                throw new Error(`${msg} Please return items and wait for admin approval first.`)
            }

            const [sport]: any = await tx.$queryRaw`SELECT * FROM "Sport" WHERE "name" = ${data.sportName} FOR UPDATE`;
            if (!sport) {
                throw new Error('Sport not found.')
            }
            const isCapacityBased = sport.maxCapacity && sport.maxCapacity > 0
            const alreadyBookedPlayers = sport.numPlayers || 0
            const numPlayers = parseInt(data.numberOfPlayers || 0)
            const courtNo = data.CourtNo
            if (isCapacityBased) {
                if (alreadyBookedPlayers + numPlayers > (sport.maxCapacity || 0)) {
                    throw new Error('Facility is full!')
                }
            }
            else {
                const cData = sport.courtData || []
                const courtIndex = parseInt(courtNo) - 1
                if (courtIndex < 0 || courtIndex >= (sport.numberOfCourts || 0)) {
                    throw new Error('Court is not available!')
                }
                if (cData[courtIndex] && cData[courtIndex].split(':')[1] === '1') {
                    throw new Error('Court already booked!')
                }

                const currentCData = Array.from({ length: sport.numberOfCourts || 0 }, (_, i) => cData[i] || `Court${i + 1}:0`)
                const newCourtData = currentCData.map((item: any, i: number) => {
                    const name = item.split(':')[0]
                    if (i === courtIndex) return `${name}:1`
                    return item
                })

                await tx.sport.update({
                    where: { id: sport.id },
                    data: {
                        courtsInUse: { increment: 1 }, courtData: newCourtData, numPlayers: { increment: numPlayers }
                    }
                })
            }
            if (data.equipmentsIssued && data.equipmentsIssued.length > 0) {
                let currentEqInUse = sport.equipmentsInUse || []
                const newEqInUse = [...currentEqInUse]

                data.equipmentsIssued.forEach((issued: string) => {
                    const [name, count] = issued.split(':')
                    const issuedCount = parseInt(count)

                    const eqIndex = newEqInUse.findIndex((eq: string) => eq.startsWith(name + ':'))
                    if (eqIndex !== -1) {
                        const [eqName, eqCount] = newEqInUse[eqIndex].split(':')
                        newEqInUse[eqIndex] = `${eqName}:${parseInt(eqCount) + issuedCount}`
                    }
                    else {
                        newEqInUse.push(`${name}:${issuedCount}`)
                    }
                })

                await tx.sport.update({
                    where: { id: sport.id },
                    data: {
                        equipmentsInUse: newEqInUse,
                        ...(isCapacityBased && { numPlayers: { increment: numPlayers } })
                    }
                })
            }
            else if (isCapacityBased) {
                await tx.sport.update({
                    where: { id: sport.id }, data: { numPlayers: { increment: numPlayers } }
                })
            }

            const booking = await tx.booking.create({
                data: {
                    userId: data.userId, sportName: data.sportName,
                    issuedEquipments: data.equipmentsIssued || [],
                    numberOfPlayers: numPlayers, startTime: data.startTime,
                    endTime: data.endTime, date: data.date,
                    qrDetail: data.qrdetail, status: data.status,
                    endDate: data.enddate, courtNo: data.CourtNo,
                },
            })
            return booking
        })
        revalidatePath('/')

        
        await notifySocketUpdate(data.sportName, 'booking_status_changed');

        return { success: true, data: result }
    }
    catch (error: any) {
        console.error('Secure booking error:', error)
        return { success: false, error: error.message || 'Failed to create booking' }
    }
}

export async function activateBooking(bookingId: string) {
    try {
        const result = await prisma.$transaction(async (tx: any) => {
            const [booking]: any = await tx.$queryRaw`SELECT * FROM "Booking" WHERE "id" = ${bookingId} FOR UPDATE`;
            if (!booking) throw new Error('Booking not found');
            if (booking.status !== 'pending') throw new Error('Booking is not in pending state');

            
            const dummyDate = '2000-01-01';
            const start = new Date(`${dummyDate}T${booking.startTime}`);
            const end = new Date(`${booking.endDate && booking.endDate !== booking.date ? '2000-01-02' : dummyDate}T${booking.endTime}`);
            const durationMs = end.getTime() - start.getTime();

            const now = new Date();
            const newStartTime = now.toTimeString().split(' ')[0];
            const newEndDate = new Date(now.getTime() + durationMs);
            const newEndTime = newEndDate.toTimeString().split(' ')[0];
            const newEndDateStr = newEndDate.toISOString().split('T')[0];
            const newDateStr = now.toISOString().split('T')[0];

            return await tx.booking.update({
                where: { id: bookingId },
                data: {
                    status: 'active',
                    scanned: true,
                    startTime: newStartTime,
                    endTime: newEndTime,
                    endDate: newEndDateStr,
                    date: newDateStr
                }
            });
        });

        revalidatePath('/admin/bookings');
        
        await notifySocketUpdate(result.sportName, 'booking_status_changed');

        return { success: true, data: result };
    } catch (error: any) {
        console.error('Activate booking error:', error);
        return { success: false, error: error.message || 'Failed to activate booking' };
    }
}
