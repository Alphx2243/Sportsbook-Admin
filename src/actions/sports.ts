'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { ActionResponse } from '@/types/interfaces'
import { v4 as uuidv4 } from 'uuid'
import { ensureRoles } from '@/lib/auth-utils'
import { equipmentList, nonNegativeInt, requiredString } from '@/lib/validation'
import { ROLES } from '@/lib/roles'
import { dateToDateString, dateToTimeString, getISTDayRange, parseBookingDateTime, syncCourtsForSport, withSportAvailability } from '@/lib/normalized-data'
import { notifySportUpdate } from '@/lib/socket-notify'

export async function createSport(data: any): Promise<ActionResponse> {
    try {
        await ensureRoles([ROLES.ADMIN, ROLES.FACILITY_MANAGER])
        const equipments = equipmentList(data.totalEquipments)
        const numberOfCourts = nonNegativeInt(data.courts, 'Number of courts')
        const sport = await prisma.$transaction(async (tx: any) => {
            const createdSport = await tx.sport.create({
                data: {
                    name: requiredString(data.name, 'Sport name'),
                    numberOfCourts,
                    maxCapacity: data.maxCapacity ? nonNegativeInt(data.maxCapacity, 'Max capacity') : null,
                    Equipment: {
                        create: equipments.map((eq) => {
                            return {
                                id: uuidv4(),
                                name: eq.name,
                                total: eq.total,
                                inUse: 0,
                                updatedAt: new Date()
                            }
                        })
                    }
                },
                include: { Equipment: true }
            })
            await syncCourtsForSport(tx, createdSport.id, numberOfCourts, data.CourtData)
            return createdSport
        })
        revalidatePath('/')
        await notifySportUpdate(sport.name);
        return { success: true, data: sport }
    }
    catch (error: any) {
        console.error('Create sport error:', error);
        return { success: false, error: error.message || 'Failed to create sport' }
    }
}

export async function updateSport(id: string, data: any): Promise<ActionResponse> {
    try {
        await ensureRoles([ROLES.ADMIN, ROLES.FACILITY_MANAGER])
        const parsedEquipment = data.totalEquipments ? equipmentList(data.totalEquipments) : undefined
        const sport = await prisma.$transaction(async (tx: any) => {
            const updatedSport = await tx.sport.update({
                where: { id },
                data: {
                    name: data.name !== undefined ? requiredString(data.name, 'Sport name') : undefined,
                    numberOfCourts: data.courts !== undefined ? nonNegativeInt(data.courts, 'Number of courts') : undefined,
                    maxCapacity: data.maxCapacity !== undefined ? nonNegativeInt(data.maxCapacity, 'Max capacity') : undefined,
                },
            })
            await syncCourtsForSport(
                tx,
                id,
                data.courts !== undefined ? nonNegativeInt(data.courts, 'Number of courts') : updatedSport.numberOfCourts,
                data.CourtData
            )

            if (parsedEquipment) {
                const existingEqs = await tx.equipment.findMany({ where: { sportId: id } });

                const incomingEqs = parsedEquipment;

                const incomingNames = incomingEqs.map((e: any) => e.name);
                await tx.equipment.deleteMany({
                    where: {
                        sportId: id,
                        name: { notIn: incomingNames }
                    }
                });

                for (const eq of incomingEqs) {
                    const existing = existingEqs.find((e: any) => e.name === eq.name);
                    if (existing) {
                        await tx.equipment.update({
                            where: { id: existing.id },
                            data: { total: eq.total, updatedAt: new Date() }
                        });
                    } else {
                        await tx.equipment.create({
                            data: {
                                id: uuidv4(),
                                name: eq.name,
                                total: eq.total,
                                inUse: 0,
                                sportId: id,
                                updatedAt: new Date()
                            }
                        });
                    }
                }
            }

            return updatedSport;
        });

        revalidatePath('/')
        await notifySportUpdate(sport.name);
        return { success: true, data: sport }
    }
    catch (error: any) {
        console.error('Update sport error:', error);
        return { success: false, error: error.message || 'Failed to update sport' }
    }
}
export async function deleteSport(id: string): Promise<ActionResponse> {
    try {
        await ensureRoles([ROLES.ADMIN, ROLES.FACILITY_MANAGER])
        const sport = await prisma.sport.delete({ where: { id }, })
        revalidatePath('/')
        await notifySportUpdate(sport.name);
        return { success: true, data: null }
    }
    catch (error: any) {
        console.error('Delete sport error:', error);
        return { success: false, error: error.message || 'Failed to delete sport' }
    }
}
export async function getSport(id: string): Promise<ActionResponse> {
    try {
        await ensureRoles([ROLES.ADMIN, ROLES.FACILITY_MANAGER])
        const sport = await prisma.sport.findUnique({
            where: { id },
            include: { Equipment: true, courts: { where: { isActive: true }, orderBy: { courtNumber: 'asc' } } }
        })
        if (!sport) return { success: false, error: 'Sport not found' }
        return { success: true, data: await withSportAvailability(prisma, sport) }
    }
    catch (error: any) {
        console.error('Get sport error:', error);
        return { success: false, error: error.message || 'Failed to get sport' }
    }
}

export async function getSports(): Promise<ActionResponse<{ documents: any[], total: number }>> {
    try {
        await ensureRoles([ROLES.ADMIN, ROLES.FACILITY_MANAGER])
        const sports = await prisma.sport.findMany({
            orderBy: { name: 'asc' },
            include: { Equipment: true, courts: { where: { isActive: true }, orderBy: { courtNumber: 'asc' } } }
        })
        const documents = await Promise.all(sports.map((sport: any) => withSportAvailability(prisma, sport)))
        return { success: true, data: { documents, total: documents.length } }
    }
    catch (error: any) {
        console.error('Get sports error:', error);
        return { success: false, error: error.message || 'Failed to get sports' }
    }
}

export async function getSportAnalytics(sportName: string): Promise<ActionResponse> {
    try {
        await ensureRoles([ROLES.ADMIN, ROLES.FACILITY_MANAGER])
        const today = new Date();
        const dates = Array.from({ length: 7 }, (_: unknown, i: number) => {
            const d = new Date(today);
            d.setDate(today.getDate() - (6 - i));
            return dateToDateString(d);
        });
        const startRange = getISTDayRange(dates[0]);
        const endRange = getISTDayRange(dates[dates.length - 1]);

        const bookings = await prisma.booking.findMany({
            where: {
                sport: { name: sportName },
                startAt: { gte: startRange.gte, lt: endRange.lt }
            }
        });

        const dayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'Asia/Kolkata' });
        const weeklyAttendance = dates.map((date: string) => {
            const dayName = dayFormatter.format(parseBookingDateTime(date, '12:00:00'));
            const dayBookings = bookings.filter((b: any) => dateToDateString(b.startAt) === date);
            const totalPlayers = dayBookings.reduce((sum: number, b: any) => sum + (b.numberOfPlayers || 0), 0);
            return { day: dayName, Students: totalPlayers };
        });

        const timeSlots = ["06-08", "08-10", "10-12", "12-14", "14-16", "16-18", "18-20", "20-22"];
        const peakHours = timeSlots.map((slot: string) => {
            const [startHour, endHour] = slot.split('-').map(Number);
            const slotBookings = bookings.filter((b: any) => {
                const hour = Number(dateToTimeString(b.startAt).split(':')[0]);
                return hour >= startHour && hour < endHour;
            });
            const totalUsersInSlot = slotBookings.reduce((sum: number, b: any) => sum + (b.numberOfPlayers || 0), 0);
            return { time: slot, Users: Math.round(totalUsersInSlot / 7) };
        });

        return { success: true, data: { weeklyAttendance, peakHours } };
    }
    catch (error: any) {
        console.error('Get sport analytics error:', error);
        return { success: false, error: error.message || 'Failed to get analytics' };
    }
}
