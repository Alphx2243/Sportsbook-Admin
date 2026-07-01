'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { ActionResponse } from '@/types/interfaces'
import { v4 as uuidv4 } from 'uuid'
import { bookingUserSelect, ensureAdmin, ensureRoles } from '@/lib/auth-utils'
import { requireServerEnv } from '@/lib/env'
import { bookingStatus, positiveInt, requiredString } from '@/lib/validation'
import { ROLES } from '@/lib/roles'

async function notifySocketUpdate(sportName: string, type: string = 'availability_changed') {
    const url = `${process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3005'}/notify-update`;
    const secret = requireServerEnv('SOCKET_INTERNAL_SECRET');

    console.log(`[SOCKET] Notifying ${url} for ${sportName} (Type: ${type})`);
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-socket-secret': secret
            },
            body: JSON.stringify({ sportName, type }),
        });
        if (!response.ok) console.error(`[SOCKET] Server returned ${response.status}`);
    } catch (error) {
        console.error('[SOCKET] Failed to notify server:', error);
    }
}

export async function createBooking(data: any): Promise<ActionResponse> {
    try {
        await ensureAdmin()
        const result = await prisma.$transaction(async (tx: any) => {
            const existingBooking = await tx.booking.findFirst({
                where: {
                    userId: data.userId,
                    status: { in: ['pending', 'active', 'returned'] }
                }
            })

            if (existingBooking) {
                const msg = existingBooking.status === 'active'
                    ? 'User already has an active booking.'
                    : 'Previous session return is pending admin approval.';
                throw new Error(`${msg} Please return items and wait for admin approval first.`)
            }

            const bookingEquipmentData = [];
            if (data.equipmentsIssued && data.equipmentsIssued.length > 0) {
                const sport = await tx.sport.findUnique({
                    where: { name: data.sportName }
                });
                if (!sport) throw new Error('Sport not found');

                for (const issued of data.equipmentsIssued) {
                    const [name, countStr] = issued.split(':');
                    const issuedCount = positiveInt(countStr, 'Issued equipment count');

                    const equipment = await tx.equipment.findFirst({
                        where: { sportId: sport.id, name: name.trim() }
                    });

                    if (!equipment) throw new Error(`Equipment ${name} not found.`);

                    await tx.equipment.update({
                        where: { id: equipment.id },
                        data: { inUse: { increment: issuedCount } }
                    });

                    bookingEquipmentData.push({
                        id: uuidv4(),
                        equipmentId: equipment.id,
                        count: issuedCount
                    });
                }
            }

            return await tx.booking.create({
                data: {
                    userId: requiredString(data.userId, 'User ID'),
                    sportName: requiredString(data.sportName, 'Sport name'),
                    numberOfPlayers: positiveInt(data.numberOfPlayers, 'Number of players'),
                    startTime: requiredString(data.startTime, 'Start time', 20),
                    endTime: requiredString(data.endTime, 'End time', 20),
                    date: requiredString(data.date, 'Date', 20),
                    qrDetail: data.qrdetail,
                    status: bookingStatus(data.status),
                    endDate: data.enddate,
                    courtNo: data.CourtNo,
                    BookingEquipment: {
                        create: bookingEquipmentData
                    }
                },
            })
        });

        revalidatePath('/')
        return { success: true, data: result }
    }
    catch (error: any) {
        console.error('Create booking error:', error)
        return { success: false, error: error.message || 'Failed to create booking' }
    }
}

export async function updateBooking(id: string, data: any): Promise<ActionResponse> {
    try {
        await ensureAdmin()
        const booking = await prisma.booking.update({
            where: { id },
            data: {
                userId: data.userId !== undefined ? requiredString(data.userId, 'User ID') : undefined,
                sportName: data.sportName !== undefined ? requiredString(data.sportName, 'Sport name') : undefined,
                numberOfPlayers: data.numberOfPlayers ? positiveInt(data.numberOfPlayers, 'Number of players') : undefined,
                startTime: data.startTime !== undefined ? requiredString(data.startTime, 'Start time', 20) : undefined,
                endTime: data.endTime !== undefined ? requiredString(data.endTime, 'End time', 20) : undefined,
                scanned: data.scanned, qrDetail: data.qrdetail,
                status: data.status !== undefined ? bookingStatus(data.status) : undefined,
                endDate: data.enddate,
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
        await ensureAdmin()
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
        await ensureAdmin()
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
        await ensureRoles([ROLES.ADMIN, ROLES.GUARD])
        const where: any = {}
        if (filters.userId) where.userId = filters.userId
        if (filters.status) where.status = bookingStatus(filters.status)
        if (filters.date) where.date = filters.date
        if (filters.timeRange) {
            where.startTime = { lte: filters.timeRange }
            where.endTime = { gt: filters.timeRange }
        }
        const bookings = await prisma.booking.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                user: {
                    select: bookingUserSelect,
                },
                BookingEquipment: {
                    include: {
                        Equipment: true
                    }
                }
            }
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
        await ensureAdmin()
        const safeExtensionMinutes = positiveInt(extensionMinutes, 'Extension minutes')
        const updatedBooking = await prisma.$transaction(async (tx: any) => {

            const [booking]: any = await tx.$queryRaw`SELECT * FROM "Booking" WHERE "id" = ${bookingId} FOR UPDATE`;
            if (!booking) throw new Error('Booking not found');

            const originalStartDate = new Date(`${booking.date}T${booking.startTime}`);
            const currentEndDate = new Date(`${booking.endDate || booking.date}T${booking.endTime}`);
            const newEndDate = new Date(currentEndDate.getTime() + safeExtensionMinutes * 60000);
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
        await ensureAdmin()
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

            const bookingEquipments = await tx.bookingEquipment.findMany({
                where: { bookingId },
                include: { Equipment: true }
            });

            for (const be of bookingEquipments) {
                await tx.equipment.update({
                    where: { id: be.equipmentId },
                    data: { inUse: { decrement: be.count } }
                });
            }
        });
        revalidatePath('/')
        revalidatePath('/dashboard')
        revalidatePath('/book-court')


        const [bookingForSport]: any = await prisma.$queryRaw`SELECT "sportName" FROM "Booking" WHERE "id" = ${bookingId}`;
        if (bookingForSport) {
            await notifySocketUpdate(bookingForSport.sportName, 'availability_changed');
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
        await ensureAdmin()
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
            await notifySocketUpdate(bookingForSport.sportName, 'availability_changed');
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
        await ensureAdmin()
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
            const numPlayers = positiveInt(data.numberOfPlayers, 'Number of players')
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
            const bookingEquipmentData = [];
            if (data.equipmentsIssued && data.equipmentsIssued.length > 0) {
                for (const issued of data.equipmentsIssued) {
                    const [name, countStr] = issued.split(':');
                    const issuedCount = positiveInt(countStr, 'Issued equipment count');

                    const equipment = await tx.equipment.findFirst({
                        where: { sportId: sport.id, name: name.trim() }
                    });

                    if (!equipment) throw new Error(`Equipment ${name} not found.`);
                    if (equipment.total - equipment.inUse < issuedCount) {
                        throw new Error(`Not enough ${name} available.`);
                    }

                    await tx.equipment.update({
                        where: { id: equipment.id },
                        data: { inUse: { increment: issuedCount } }
                    });

                    bookingEquipmentData.push({
                        id: uuidv4(),
                        equipmentId: equipment.id,
                        count: issuedCount
                    });
                }
            }
            else if (isCapacityBased) {
                await tx.sport.update({
                    where: { id: sport.id }, data: { numPlayers: { increment: numPlayers } }
                })
            }

            const booking = await tx.booking.create({
                data: {
                    userId: requiredString(data.userId, 'User ID'),
                    sportName: requiredString(data.sportName, 'Sport name'),
                    numberOfPlayers: numPlayers,
                    startTime: requiredString(data.startTime, 'Start time', 20),
                    endTime: requiredString(data.endTime, 'End time', 20),
                    date: requiredString(data.date, 'Date', 20),
                    qrDetail: data.qrdetail,
                    status: bookingStatus(data.status),
                    endDate: data.enddate,
                    courtNo: data.CourtNo,
                    BookingEquipment: {
                        create: bookingEquipmentData
                    }
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

import { getISTDate, formatISTTime } from '@/lib/utils';

export async function activateBooking(bookingId: string) {
    try {
        await ensureRoles([ROLES.ADMIN, ROLES.GUARD])
        const result = await prisma.$transaction(async (tx: any) => {
            const [booking]: any = await tx.$queryRaw`SELECT * FROM "Booking" WHERE "id" = ${bookingId} FOR UPDATE`;
            if (!booking) throw new Error('Booking not found');
            if (booking.status !== 'pending') throw new Error('Booking is not in pending state');


            const dummyDate = '2000-01-01';
            const start = new Date(`${dummyDate}T${booking.startTime}`);
            const end = new Date(`${booking.endDate && booking.endDate !== booking.date ? '2000-01-02' : dummyDate}T${booking.endTime}`);
            const durationMs = end.getTime() - start.getTime();

            const istNow = getISTDate();
            const { time: newStartTime, date: newDateStr } = formatISTTime(istNow);

            const istEnd = new Date(istNow.getTime() + durationMs);
            const { time: newEndTime, date: newEndDateStr } = formatISTTime(istEnd);

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

        await notifySocketUpdate(result.sportName, 'availability_changed');

        return { success: true, data: result };
    } catch (error: any) {
        console.error('Activate booking error:', error);
        return { success: false, error: error.message || 'Failed to activate booking' };
    }
}

export async function AddGymQRLog(UserGymId : string) {
    try {
        await ensureAdmin();
        const ExitTime = getISTDate();
        console.log("ExitTime: ", ExitTime);
        try{
            const result = await prisma.$transaction(async (tx: any) => {
            const existingLog = await tx.gymLog.findFirst({
                where: {
                    userId: UserGymId,
                    status: { in: ['active'] }
                }
            })
            console.log("Existing Log: ", existingLog);
            if(existingLog) {
                const bookingId = existingLog.id;
                const log = await prisma.gymLog.update({
                    where: { 
                        id: bookingId,
                        status: { in: ['active'] }
                     },
                    data: { 
                        status: 'completed',
                        exitTime: ExitTime,
                        updatedAt: ExitTime,
                    }
                })
                return {success: true, data: log};
            }
            const log = await prisma.gymLog.create({
                data: {
                    id: uuidv4(),
                    userId: UserGymId,
                    entryTime: ExitTime,
                    status: 'active',
                    createdAt: ExitTime,
                    updatedAt: ExitTime,
                }
            })
        })
        console.log("Booking.ts result: ", result);
        return {success: true, data: result};
    }
    catch(err: any){
        console.log("Error in AddGymQRLog: ", err);
        return {success: false, error: err.message || 'Failed to add gym QR log'};
    }
    }
    catch (error: any) {
    }
}