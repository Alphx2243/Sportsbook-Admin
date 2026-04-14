'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'
import type { ActionResponse } from '@/types/interfaces'
import { ensureAdmin } from '@/lib/auth-utils'

async function notifySocketUpdate(sportName: string, type: string = 'availability_changed') {
    const url = `${process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3005'}/notify-update`;
    const secret = process.env.SOCKET_INTERNAL_SECRET || 'your_default_secure_secret_here';

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

async function notifyMatchesUpdate() {
    const url = `${process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3005'}/notify-matches`;
    const secret = process.env.SOCKET_INTERNAL_SECRET || 'your_default_secure_secret_here';

    console.log(`[SOCKET] Notifying ${url} for matches update`);
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-socket-secret': secret
            },
        });
        if (!response.ok) console.error(`[SOCKET] Server returned ${response.status}`);
    } catch (error) {
        console.error('[SOCKET] Failed to notify matches server:', error);
    }
}

export async function getAdminStats(): Promise<ActionResponse> {
    try {
        await ensureAdmin();
        const [userCount, bookingCount, sportCount, activeBookings] = await Promise.all([
            prisma.user.count(),
            prisma.booking.count(),
            prisma.sport.count(),
            prisma.booking.count({ where: { status: { in: ['active', 'returned'] } } })
        ])

        return {
            success: true,
            data: {
                userCount,
                bookingCount,
                sportCount,
                activeBookings
            }
        }
    } catch (error: any) {
        console.error('Get admin stats error:', error)
        return { success: false, error: error.message }
    }
}

export async function getAllUsers(): Promise<ActionResponse> {
    try {
        await ensureAdmin();
        const users = await prisma.user.findMany({
            orderBy: { createdAt: 'desc' }
        })
        return { success: true, data: users }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function createUser(data: any): Promise<ActionResponse> {
    try {
        await ensureAdmin();
        const hashedPassword = await bcrypt.hash(data.password, 10)
        const user = await prisma.user.create({
            data: {
                name: data.name,
                email: data.email,
                password: hashedPassword,
                phone: data.phone,
                rollNumber: data.rollNumber,
                role: data.role || 'user'
            }
        })
        revalidatePath('/admin/users')
        return { success: true, data: user }
    } catch (error: any) {
        console.error('Create user error:', error)
        return { success: false, error: error.message }
    }
}

export async function updateUserRole(userId: string, role: string): Promise<ActionResponse> {
    try {
        await ensureAdmin();
        await prisma.user.update({
            where: { id: userId },
            data: { role }
        })
        revalidatePath('/admin/users')
        return { success: true, data: null }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function deleteUser(userId: string): Promise<ActionResponse> {
    try {
        await ensureAdmin();
        await prisma.$transaction([
            prisma.booking.deleteMany({ where: { userId } }),
            prisma.gymLog.deleteMany({ where: { userId } }),
            prisma.user.delete({ where: { id: userId } })
        ])
        revalidatePath('/admin/users')
        return { success: true, data: null }
    } catch (error: any) {
        console.error('Delete user error:', error)
        return { success: false, error: error.message }
    }
}

export async function approveReturn(bookingId: string): Promise<ActionResponse> {
    try {
        await ensureAdmin();
        await prisma.$transaction(async (tx: any) => {
            const [booking]: any = await tx.$queryRaw`SELECT * FROM "Booking" WHERE "id" = ${bookingId} FOR UPDATE`;
            if (!booking || booking.status !== 'returned') {
                throw new Error('Booking not found or not in returned state');
            }

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
                data: { equipmentsInUse: newEqInUse }
            });

            await tx.booking.update({
                where: { id: bookingId },
                data: { status: 'expired' }
            });
        });

        revalidatePath('/admin/bookings')
        revalidatePath('/dashboard')
        
        const booking: any = await prisma.booking.findUnique({ where: { id: bookingId } })
        if (booking) {
            await notifySocketUpdate(booking.sportName, 'availability_changed');
        }

        return { success: true, data: null }
    } catch (error: any) {
        console.error('Approve return error:', error)
        return { success: false, error: error.message }
    }
}

export async function updateSportInventory(sportId: string, data: any): Promise<ActionResponse> {
    try {
        await ensureAdmin();
        await prisma.sport.update({
            where: { id: sportId },
            data: {
                numberOfCourts: data.numberOfCourts !== undefined ? parseInt(data.numberOfCourts) : undefined,
                totalEquipments: data.totalEquipments,
                maxCapacity: data.maxCapacity !== undefined ? parseInt(data.maxCapacity) : undefined,
                courtsInUse: data.courtsInUse !== undefined ? parseInt(data.courtsInUse) : undefined,
                numPlayers: data.numPlayers !== undefined ? parseInt(data.numPlayers) : undefined,
            }
        })
        revalidatePath('/admin/sports')
        revalidatePath('/')
        return { success: true, data: null }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function getAllMatches(): Promise<ActionResponse> {
    try {
        await ensureAdmin();
        const matches = await prisma.match.findMany({
            orderBy: { createdAt: 'desc' }
        })
        return { success: true, data: matches }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function createMatch(data: any): Promise<ActionResponse> {
    try {
        await ensureAdmin();
        const match = await prisma.match.create({
            data: {
                sportName: data.sportName,
                team1: data.team1,
                team2: data.team2,
                score1: data.score1,
                score2: data.score2,
                status: data.status || 'live'
            }
        })
        revalidatePath('/admin/matches')
        revalidatePath('/live-scores')
        await notifyMatchesUpdate();
        return { success: true, data: match }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function updateMatch(matchId: string, data: any): Promise<ActionResponse> {
    try {
        await ensureAdmin();
        await prisma.match.update({
            where: { id: matchId },
            data: {
                score1: data.score1,
                score2: data.score2,
                status: data.status,
                team1: data.team1,
                team2: data.team2,
            }
        })
        revalidatePath('/admin/matches')
        revalidatePath('/live-scores')
        await notifyMatchesUpdate();
        return { success: true, data: null }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function deleteMatch(matchId: string): Promise<ActionResponse> {
    try {
        await ensureAdmin();
        const match = await prisma.match.delete({
            where: { id: matchId }
        })
        revalidatePath('/admin/matches')
        revalidatePath('/live-scores')
        await notifyMatchesUpdate();
        return { success: true, data: null }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}
