'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { ActionResponse } from '@/types/interfaces'
import { v4 as uuidv4 } from 'uuid'
import { bookingUserSelect, ensureAdmin, ensureRoles } from '@/lib/auth-utils'
import { bookingStatus, positiveInt, requiredString } from '@/lib/validation'
import { ROLES } from '@/lib/roles'
import { createBookingQrPayload, parseBookingQrPayload, verifyBookingQrPayload } from '@/lib/booking-qr'
import { dateToDateString, dateToTimeString, getISTDayRange, parseBookingDateTime, resolveCourtByNo, resolveSportByName, withBookingDisplay } from '@/lib/normalized-data'
import { notifySportUpdate } from '@/lib/socket-notify'

export async function createBooking(data: any): Promise<ActionResponse> {
    try {
        await ensureAdmin()
        const result = await prisma.$transaction(async (tx: any) => {
            const existingBooking = await tx.booking.findFirst({
                where: {
                    userId: data.userId,
                    status: { in: ['pending', 'active', 'returned', 'expired'] }
                }
            })

            if (existingBooking) {
                const msg = existingBooking.status === 'active' || existingBooking.status === 'returned' || existingBooking.status === 'expired'
                    ? 'User already has an active booking.'
                    : 'User already has a pending booking.';
                throw new Error(`${msg} Please complete it before booking again.`)
            }

            const bookingEquipmentData = [];
            const sport = await resolveSportByName(tx, requiredString(data.sportName, 'Sport name'))
            if (data.equipmentsIssued && data.equipmentsIssued.length > 0) {
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
            const court = await resolveCourtByNo(tx, sport.id, data.CourtNo)

            const booking = await tx.booking.create({
                data: {
                    userId: requiredString(data.userId, 'User ID'),
                    sportId: sport.id,
                    courtId: court?.id,
                    numberOfPlayers: positiveInt(data.numberOfPlayers, 'Number of players'),
                    startAt: parseBookingDateTime(requiredString(data.date, 'Date', 20), requiredString(data.startTime, 'Start time', 20)),
                    endAt: parseBookingDateTime(requiredString(data.enddate || data.date, 'End date', 20), requiredString(data.endTime, 'End time', 20)),
                    qrDetail: data.qrdetail,
                    status: bookingStatus(data.status),
                    BookingEquipment: {
                        create: bookingEquipmentData
                    }
                },
                include: { sport: true, court: true },
            })
            return await tx.booking.update({
                where: { id: booking.id },
                data: buildSignedQrUpdate(booking, data.qrdetail),
                include: { sport: true, court: true },
            })
        });

        revalidatePath('/')
        return { success: true, data: withBookingDisplay(result) }
    }
    catch (error: any) {
        console.error('Create booking error:', error)
        return { success: false, error: error.message || 'Failed to create booking' }
    }
}

export async function updateBooking(id: string, data: any): Promise<ActionResponse> {
    try {
        await ensureAdmin()
        const existing = await prisma.booking.findUnique({ where: { id }, include: { sport: true, court: true } })
        if (!existing) throw new Error('Booking not found')
        const updateData: any = {
            userId: data.userId !== undefined ? requiredString(data.userId, 'User ID') : undefined,
            numberOfPlayers: data.numberOfPlayers ? positiveInt(data.numberOfPlayers, 'Number of players') : undefined,
            startAt: data.startTime !== undefined || data.date !== undefined
                ? parseBookingDateTime(data.date || dateToDateString(existing.startAt), data.startTime || dateToTimeString(existing.startAt))
                : undefined,
            endAt: data.endTime !== undefined || data.enddate !== undefined || data.date !== undefined
                ? parseBookingDateTime(data.enddate || data.date || dateToDateString(existing.endAt), data.endTime || dateToTimeString(existing.endAt))
                : undefined,
            scanned: data.scanned,
            qrDetail: data.qrdetail,
            status: data.status !== undefined ? bookingStatus(data.status) : undefined,
        }
        if (data.sportName || data.CourtNo !== undefined) {
            const sport = data.sportName ? await resolveSportByName(prisma, data.sportName) : existing.sport
            const court = await resolveCourtByNo(prisma, sport.id, data.CourtNo ?? existing.court?.courtNumber?.toString())
            updateData.sportId = sport.id
            updateData.courtId = court?.id || null
        }
        const booking = await prisma.booking.update({
            where: { id },
            data: updateData,
            include: { sport: true, court: true },
        })
        revalidatePath('/')
        return { success: true, data: withBookingDisplay(booking) }
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
        const booking = await prisma.booking.findUnique({ where: { id }, include: { sport: true, court: true } })
        if (!booking) return { success: false, error: 'Booking not found' }
        return { success: true, data: withBookingDisplay(booking) }
    }
    catch (error: any) {
        console.error('Get booking error:', error)
        return { success: false, error: error.message || 'Failed to get booking' }
    }
}

export async function getBookings(filters: { userId?: string; status?: string; date?: string; timeRange?: string } = {}): Promise<ActionResponse<{ documents: any[], total: number }>> {
    try {
        await ensureRoles([ROLES.ADMIN, ROLES.GUARD])
        await expireOverdueBookings()
        const where: any = {}
        if (filters.userId) where.userId = filters.userId
        if (filters.status) where.status = bookingStatus(filters.status)
        if (filters.date) {
            where.startAt = getISTDayRange(filters.date)
        }
        if (filters.timeRange) {
            const day = filters.date || dateToDateString(new Date())
            const time = parseBookingDateTime(day, filters.timeRange)
            where.startAt = { ...(where.startAt || {}), lte: time }
            where.endAt = { gt: time }
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
                },
                sport: true,
                court: true,
            }
        })
        const documents = bookings.map(withBookingQrDisplay)
        return { success: true, data: { documents, total: documents.length } }
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

            const originalStartDate = new Date(booking.startAt);
            const currentEndDate = new Date(booking.endAt);
            const newEndDate = new Date(currentEndDate.getTime() + safeExtensionMinutes * 60000);
            const totalDurationMs = newEndDate.getTime() - originalStartDate.getTime();
            const totalDurationMinutes = totalDurationMs / (1000 * 60);

            if (totalDurationMinutes > 240) {
                throw new Error('Total booking duration cannot exceed 4 hours');
            }

            return await tx.booking.update({
                where: { id: bookingId },
                data: { endAt: newEndDate }
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
            if (!booking || (booking.status !== 'active' && booking.status !== 'pending')) {
                throw new Error('Booking not found or already inactive');
            }
            if (new Date(booking.endAt).getTime() > Date.now()) {
                throw new Error('Booking time has not ended yet.');
            }

            const [sportRow]: any = await tx.$queryRaw`SELECT * FROM "Sport" WHERE "id" = ${booking.sportId} FOR UPDATE`;
            if (!sportRow) {
                throw new Error('Associated Sport not found');
            }

            await tx.booking.update({
                where: { id: bookingId },
                data: { status: 'expired' }
            });

            if (booking.status === 'pending') {
                await restoreBookingEquipment(tx, bookingId);
            }
        });
        revalidatePath('/')
        revalidatePath('/dashboard')
        revalidatePath('/book-court')


        const bookingForSport: any = await prisma.booking.findUnique({ where: { id: bookingId }, include: { sport: true } });
        if (bookingForSport) {
            await notifySportUpdate(bookingForSport.sport.name, 'availability_changed');
        }

        return { success: true, data: null }
    }
    catch (error: any) {
        console.error('Expire booking error:', error)
        return { success: false, error: error.message || 'Failed to expire booking' }
    }
}

export async function completeBooking(bookingId: string): Promise<ActionResponse> {
    try {
        await ensureRoles([ROLES.ADMIN, ROLES.GUARD])
        const endedAt = getISTDate()
        await prisma.$transaction(async (tx: any) => {
            const [booking]: any = await tx.$queryRaw`SELECT * FROM "Booking" WHERE "id" = ${bookingId} FOR UPDATE`;
            if (!booking || (booking.status !== 'active' && booking.status !== 'returned' && booking.status !== 'expired')) {
                throw new Error('Booking not found or cannot be completed');
            }

            const [sport]: any = await tx.$queryRaw`SELECT * FROM "Sport" WHERE "id" = ${booking.sportId} FOR UPDATE`;
            if (!sport) {
                throw new Error('Associated Sport not found');
            }

            await tx.booking.update({
                where: { id: bookingId },
                data: {
                    status: 'completed',
                    endAt: booking.status === 'active' ? endedAt : undefined,
                }
            });
            if (booking.status === 'active' || booking.status === 'returned' || booking.scanned) {
                await restoreBookingEquipment(tx, bookingId);
            }
        });

        revalidatePath('/')
        revalidatePath('/dashboard')
        revalidatePath('/book-court')


        const bookingForSport: any = await prisma.booking.findUnique({ where: { id: bookingId }, include: { sport: true } });
        if (bookingForSport) {
            await notifySportUpdate(bookingForSport.sport.name, 'availability_changed');
        }

        return { success: true, data: null }
    }
    catch (error: any) {
        console.error('Complete booking error:', error)
        return { success: false, error: error.message || 'Failed to complete booking' }
    }
}

export async function secureBooking(data: any): Promise<ActionResponse> {
    try {
        await ensureAdmin()
        const result = await prisma.$transaction(async (tx: any) => {
            const existingBooking = await tx.booking.findFirst({
                where: { userId: data.userId, status: { in: ['pending', 'active', 'returned', 'expired'] } }
            })
            if (existingBooking) {
                const msg = existingBooking.status === 'active' || existingBooking.status === 'returned' || existingBooking.status === 'expired'
                    ? 'You already have an active booking.'
                    : 'You already have a pending booking.';
                throw new Error(`${msg} Please complete it before booking again.`)
            }

            const [sport]: any = await tx.$queryRaw`SELECT * FROM "Sport" WHERE "name" = ${data.sportName} FOR UPDATE`;
            if (!sport) {
                throw new Error('Sport not found.')
            }
            const isCapacityBased = sport.maxCapacity && sport.maxCapacity > 0
            const activeBookings = await tx.booking.findMany({ where: { sportId: sport.id, status: { in: ['pending', 'active', 'returned'] } } })
            const alreadyBookedPlayers = activeBookings.reduce((sum: number, booking: any) => sum + (booking.numberOfPlayers || 0), 0)
            const numPlayers = positiveInt(data.numberOfPlayers, 'Number of players')
            const courtNo = data.CourtNo
            if (isCapacityBased) {
                if (alreadyBookedPlayers + numPlayers > (sport.maxCapacity || 0)) {
                    throw new Error('Facility is full!')
                }
            }
            else {
                const courtIndex = parseInt(courtNo) - 1
                if (courtIndex < 0 || courtIndex >= (sport.numberOfCourts || 0)) {
                    throw new Error('Court is not available!')
                }
                const requestedCourt = await resolveCourtByNo(tx, sport.id, courtNo)
                const occupied = requestedCourt ? activeBookings.some((booking: any) => booking.courtId === requestedCourt.id) : false
                if (occupied) {
                    throw new Error('Court already booked!')
                }
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

            const court = await resolveCourtByNo(tx, sport.id, data.CourtNo)
            const booking = await tx.booking.create({
                data: {
                    userId: requiredString(data.userId, 'User ID'),
                    sportId: sport.id,
                    courtId: court?.id,
                    numberOfPlayers: numPlayers,
                    startAt: parseBookingDateTime(requiredString(data.date, 'Date', 20), requiredString(data.startTime, 'Start time', 20)),
                    endAt: parseBookingDateTime(requiredString(data.enddate || data.date, 'End date', 20), requiredString(data.endTime, 'End time', 20)),
                    qrDetail: data.qrdetail,
                    status: bookingStatus(data.status),
                    BookingEquipment: {
                        create: bookingEquipmentData
                    }
                },
                include: { sport: true, court: true },
            })
            return await tx.booking.update({
                where: { id: booking.id },
                data: buildSignedQrUpdate(booking, data.qrdetail),
                include: { sport: true, court: true },
            })
        })
        revalidatePath('/')


        await notifySportUpdate(data.sportName, 'booking_status_changed');

        return { success: true, data: withBookingDisplay(result) }
    }
    catch (error: any) {
        console.error('Secure booking error:', error)
        return { success: false, error: error.message || 'Failed to create booking' }
    }
}

import { getISTDate, formatISTTime } from '@/lib/utils';

export async function activateBooking(qrData: string) {
    try {
        await ensureRoles([ROLES.ADMIN, ROLES.GUARD])
        const scannedPayload = parseBookingQrPayload(qrData)
        const result = await prisma.$transaction(async (tx: any) => {
            const bookingId = scannedPayload.bookingId
            const [booking]: any = await tx.$queryRaw`SELECT * FROM "Booking" WHERE "id" = ${bookingId} FOR UPDATE`;
            if (!booking) throw new Error('Booking not found');
            if (booking.status !== 'pending') throw new Error('Booking is not in pending state');
            if (new Date(booking.endAt).getTime() <= Date.now()) {
                await tx.booking.update({ where: { id: bookingId }, data: { status: 'expired' } });
                await restoreBookingEquipment(tx, bookingId);
                throw new Error('Booking expired before QR scan.');
            }
            verifyBookingQrPayload(qrData, {
                bookingId: booking.id,
                userId: booking.userId,
                sportId: booking.sportId,
                numberOfPlayers: booking.numberOfPlayers,
                startAt: booking.startAt,
                endAt: booking.endAt,
                courtId: booking.courtId,
                qrHash: booking.qrHash,
            })


            const start = new Date(booking.startAt);
            const end = new Date(booking.endAt);
            const durationMs = end.getTime() - start.getTime();

            const istNow = getISTDate();
            const istEnd = new Date(istNow.getTime() + durationMs);

            return await tx.booking.update({
                where: { id: bookingId },
                data: {
                    status: 'active',
                    scanned: true,
                    startAt: istNow,
                    endAt: istEnd,
                },
                include: { sport: true, court: true },
            });
        });

        revalidatePath('/admin/bookings');

        await notifySportUpdate(result.sport.name, 'availability_changed');

        return { success: true, data: withBookingDisplay(result) };
    } catch (error: any) {
        console.error('Activate booking error:', error);
        return { success: false, error: error.message || 'Failed to activate booking' };
    }
}

function buildSignedQrUpdate(booking: any, qrDetail?: string) {
    const payload = createBookingQrPayload({
        bookingId: booking.id,
        userId: booking.userId,
        sportId: booking.sportId,
        numberOfPlayers: booking.numberOfPlayers,
        startAt: booking.startAt,
        endAt: booking.endAt,
        courtId: booking.courtId,
    })

    return {
        qrDetail: JSON.stringify(payload),
        qrHash: payload.h,
    }
}

function withBookingQrDisplay(booking: any) {
    const displayBooking = withBookingDisplay(booking)
    const payload = createBookingQrPayload({
        bookingId: booking.id,
        userId: booking.userId,
        sportId: booking.sportId,
        numberOfPlayers: booking.numberOfPlayers,
        startAt: booking.startAt,
        endAt: booking.endAt,
        courtId: booking.courtId,
    })

    return {
        ...displayBooking,
        qrDetail: JSON.stringify(payload),
    }
}

async function restoreBookingEquipment(tx: any, bookingId: string) {
    const bookingEquipments = await tx.bookingEquipment.findMany({ where: { bookingId } });
    for (const be of bookingEquipments) {
        await tx.equipment.update({
            where: { id: be.equipmentId },
            data: { inUse: { decrement: be.count } }
        });
    }
}

async function expireOverdueBookings() {
    const now = getISTDate()
    await prisma.$transaction(async (tx: any) => {
        const overduePendingBookings = await tx.booking.findMany({
            where: { status: 'pending', endAt: { lte: now } },
            select: { id: true },
        })

        for (const booking of overduePendingBookings) {
            await tx.booking.update({ where: { id: booking.id }, data: { status: 'expired' } })
            await restoreBookingEquipment(tx, booking.id)
        }

        await tx.booking.updateMany({
            where: { status: 'active', endAt: { lte: now } },
            data: { status: 'expired' },
        })
    })
}

export async function AddGymQRLog(UserGymId : string) {
    try {
        await ensureRoles([ROLES.ADMIN, ROLES.GUARD]);
        const now = getISTDate();
        const result = await prisma.$transaction(async (tx: any) => {
            const existingLog = await tx.gymLog.findFirst({
                where: {
                    userId: UserGymId,
                    status: { in: ['active'] }
                }
            })
            if(existingLog) {
                const durationHours = parseFloat(((now.getTime() - new Date(existingLog.entryTime).getTime()) / (1000 * 60 * 60)).toFixed(2))
                const log = await tx.gymLog.update({
                    where: { id: existingLog.id },
                    data: { 
                        status: 'completed',
                        exitTime: now,
                        duration: durationHours,
                        updatedAt: now,
                    }
                })
                return withGymScanDisplay('finished', log);
            }

            const log = await tx.gymLog.create({
                data: {
                    id: uuidv4(),
                    userId: UserGymId,
                    entryTime: now,
                    status: 'active',
                    createdAt: now,
                    updatedAt: now,
                }
            })
            return withGymScanDisplay('created', log);
        })
        revalidatePath('/gym-scanner')
        return {success: true, data: result};
    }
    catch (error: any) {
        console.error("Error in AddGymQRLog: ", error);
        return {success: false, error: error.message || 'Failed to process gym QR'};
    }
}

function withGymScanDisplay(action: 'created' | 'finished', log: any) {
    const entry = formatISTTime(new Date(log.entryTime))
    const exit = log.exitTime ? formatISTTime(new Date(log.exitTime)) : null

    return {
        action,
        message: action === 'created' ? 'Gym booking created' : 'Gym booking finished',
        id: log.id,
        status: log.status,
        entryDate: entry.date,
        entryTime: entry.time,
        exitDate: exit?.date || null,
        exitTime: exit?.time || null,
        duration: log.duration ? `${log.duration} h` : null,
    }
}
