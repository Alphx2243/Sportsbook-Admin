'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'
import type { ActionResponse } from '@/types/interfaces'
import { ensureAdmin, ensureRoles, publicUserSelect } from '@/lib/auth-utils'
import { v4 as uuidv4 } from 'uuid'
import { requireServerEnv } from '@/lib/env'
import { equipmentList, matchStatus, nonNegativeInt, requiredString, roleValue } from '@/lib/validation'
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

async function notifyMatchesUpdate() {
    const url = `${process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3005'}/notify-matches`;
    const secret = requireServerEnv('SOCKET_INTERNAL_SECRET');

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
            orderBy: { createdAt: 'desc' },
            select: publicUserSelect,
        })
        return { success: true, data: users }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function createUser(data: any): Promise<ActionResponse> {
    try {
        await ensureAdmin();
        const password = requiredString(data.password, 'Password', 256)
        if (password.length < 12) throw new Error('Password must be at least 12 characters.')
        const hashedPassword = await bcrypt.hash(password, 10)
        const user = await prisma.user.create({
            data: {
                name: requiredString(data.name, 'Name'),
                email: requiredString(data.email, 'Email').toLowerCase(),
                password: hashedPassword,
                phone: requiredString(data.phone, 'Phone', 30),
                rollNumber: requiredString(data.rollNumber, 'Roll number', 50),
                role: roleValue(data.role)
            },
            select: publicUserSelect,
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
            data: { role: roleValue(role) }
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
        await ensureRoles([ROLES.ADMIN, ROLES.GUARD]);
        await prisma.$transaction(async (tx: any) => {
            const [booking]: any = await tx.$queryRaw`SELECT * FROM "Booking" WHERE "id" = ${bookingId} FOR UPDATE`;
            if (!booking || booking.status !== 'returned') {
                throw new Error('Booking not found or not in returned state');
            }

            const [sport]: any = await tx.$queryRaw`SELECT * FROM "Sport" WHERE "name" = ${booking.sportName} FOR UPDATE`;
            if (!sport) {
                throw new Error('Associated Sport not found');
            }

            await tx.booking.update({
                where: { id: bookingId },
                data: { status: 'expired' }
            });

            const bookingEquipments = await tx.bookingEquipment.findMany({
                where: { bookingId }
            });

            for (const be of bookingEquipments) {
                await tx.equipment.update({
                    where: { id: be.equipmentId },
                    data: { inUse: { decrement: be.count } }
                });
            }
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
        await ensureRoles([ROLES.ADMIN, ROLES.FACILITY_MANAGER]);
        const parsedEquipment = data.totalEquipments ? equipmentList(data.totalEquipments) : undefined
        await prisma.$transaction(async (tx: any) => {
            await tx.sport.update({
                where: { id: sportId },
                data: {
                    numberOfCourts: data.numberOfCourts !== undefined ? nonNegativeInt(data.numberOfCourts, 'Number of courts') : undefined,
                    maxCapacity: data.maxCapacity !== undefined ? nonNegativeInt(data.maxCapacity, 'Max capacity') : undefined,
                    courtsInUse: data.courtsInUse !== undefined ? nonNegativeInt(data.courtsInUse, 'Courts in use') : undefined,
                    numPlayers: data.numPlayers !== undefined ? nonNegativeInt(data.numPlayers, 'Active players') : undefined,
                }
            })

            if (parsedEquipment) {
                const existingEqs = await tx.equipment.findMany({ where: { sportId } });
                const incomingEqs = parsedEquipment;

                const incomingNames = incomingEqs.map((e: any) => e.name);
                await tx.equipment.deleteMany({
                    where: {
                        sportId,
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
                                sportId: sportId,
                                updatedAt: new Date()
                            }
                        });
                    }
                }
            }
        });

        revalidatePath('/admin/sports')
        revalidatePath('/')
        return { success: true, data: null }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function getAllMatches(): Promise<ActionResponse> {
    try {
        await ensureRoles([ROLES.ADMIN, ROLES.FACILITY_MANAGER]);
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
        await ensureRoles([ROLES.ADMIN, ROLES.FACILITY_MANAGER]);
        const match = await prisma.match.create({
            data: {
                sportName: requiredString(data.sportName, 'Sport name'),
                team1: requiredString(data.team1, 'Team 1'),
                team2: requiredString(data.team2, 'Team 2'),
                score1: nonNegativeInt(data.score1, 'Score 1', 0).toString(),
                score2: nonNegativeInt(data.score2, 'Score 2', 0).toString(),
                status: matchStatus(data.status)
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
        await ensureRoles([ROLES.ADMIN, ROLES.FACILITY_MANAGER]);
        await prisma.match.update({
            where: { id: matchId },
            data: {
                score1: data.score1 !== undefined ? nonNegativeInt(data.score1, 'Score 1').toString() : undefined,
                score2: data.score2 !== undefined ? nonNegativeInt(data.score2, 'Score 2').toString() : undefined,
                status: data.status !== undefined ? matchStatus(data.status) : undefined,
                team1: data.team1 !== undefined ? requiredString(data.team1, 'Team 1') : undefined,
                team2: data.team2 !== undefined ? requiredString(data.team2, 'Team 2') : undefined,
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
        await ensureRoles([ROLES.ADMIN, ROLES.FACILITY_MANAGER]);
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
