'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { ActionResponse } from '@/types/interfaces'

async function notifySocketUpdate(sportName: string, type: string = 'availability_changed') {
    const url = `${process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3005'}/notify-update`;
    const secret = process.env.SOCKET_INTERNAL_SECRET || 'your_default_secure_secret_here';

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

export async function createSport(data: any): Promise<ActionResponse> {
    try {
        const sport = await prisma.sport.create({
            data: {
                name: data.name, numberOfCourts: parseInt(data.courts),
                totalEquipments: data.totalEquipments || [],
                equipmentsInUse: data.eqinuse || [], courtsInUse: parseInt(data.crtinuse || 0),
                numPlayers: parseInt(data.numplayers || 0), courtData: data.CourtData,
            },
        })
        revalidatePath('/')
        await notifySocketUpdate(sport.name);
        return { success: true, data: sport }
    }
    catch (error: any) {
        console.error('Create sport error:', error);
        return { success: false, error: error.message || 'Failed to create sport' }
    }
}

export async function updateSport(id: string, data: any): Promise<ActionResponse> {
    try {
        const sport = await prisma.sport.update({
            where: { id },
            data: {
                name: data.name, numberOfCourts: data.courts ? parseInt(data.courts) : undefined,
                totalEquipments: data.totalEquipments, equipmentsInUse: data.eqinuse,
                courtsInUse: data.crtinuse ? parseInt(data.crtinuse) : undefined,
                numPlayers: data.numplayers !== undefined ? parseInt(data.numplayers) : undefined,
                courtData: data.CourtData,
            },
        })
        revalidatePath('/')
        await notifySocketUpdate(sport.name);
        return { success: true, data: sport }
    }
    catch (error: any) {
        console.error('Update sport error:', error);
        return { success: false, error: error.message || 'Failed to update sport' }
    }
}
export async function deleteSport(id: string): Promise<ActionResponse> {
    try {
        const sport = await prisma.sport.delete({ where: { id }, })
        revalidatePath('/')
        await notifySocketUpdate(sport.name);
        return { success: true, data: null }
    }
    catch (error: any) {
        console.error('Delete sport error:', error);
        return { success: false, error: error.message || 'Failed to delete sport' }
    }
}
export async function getSport(id: string): Promise<ActionResponse> {
    try {
        const sport = await prisma.sport.findUnique({ where: { id }, })
        if (!sport) return { success: false, error: 'Sport not found' }
        return { success: true, data: sport }
    }
    catch (error: any) {
        console.error('Get sport error:', error);
        return { success: false, error: error.message || 'Failed to get sport' }
    }
}

export async function getSports(): Promise<ActionResponse<{ documents: any[], total: number }>> {
    try {
        const sports = await prisma.sport.findMany({ orderBy: { name: 'asc' }, })
        return { success: true, data: { documents: sports, total: sports.length } }
    }
    catch (error: any) {
        console.error('Get sports error:', error);
        return { success: false, error: error.message || 'Failed to get sports' }
    }
}

export async function getSportAnalytics(sportName: string): Promise<ActionResponse> {
    try {
        const today = new Date();
        const dates = Array.from({ length: 7 }, (_: unknown, i: number) => {
            const d = new Date(today);
            d.setDate(today.getDate() - (6 - i));
            return d.toISOString().split('T')[0];
        });

        const bookings = await prisma.booking.findMany({
            where: {
                sportName: sportName,
                date: { in: dates }
            }
        });

        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const weeklyAttendance = dates.map((date: string) => {
            const dateObj = new Date(date);
            const dayName = days[dateObj.getDay()];
            const dayBookings = bookings.filter((b: any) => b.date === date);
            const totalPlayers = dayBookings.reduce((sum: number, b: any) => sum + (b.numberOfPlayers || 0), 0);
            return { day: dayName, Students: totalPlayers };
        });

        const timeSlots = ["06-08", "08-10", "10-12", "12-14", "14-16", "16-18", "18-20", "20-22"];
        const peakHours = timeSlots.map((slot: string) => {
            const [startHour, endHour] = slot.split('-').map(Number);
            const slotBookings = bookings.filter((b: any) => {
                const hour = parseInt(b.startTime.split(':')[0]);
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
