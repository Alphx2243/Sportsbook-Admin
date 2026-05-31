import prisma from '@/lib/prisma'
import { verifySessionToken } from '@/lib/auth-config'
import { cookies } from 'next/headers'

export const publicUserSelect = {
    id: true,
    email: true,
    name: true,
    phone: true,
    rollNumber: true,
    sportsExperience: true,
    qrCodePath: true,
    role: true,
    createdAt: true,
    updatedAt: true,
} as const

export const bookingUserSelect = {
    id: true,
    email: true,
    name: true,
    phone: true,
    rollNumber: true,
    qrCodePath: true,
    role: true,
} as const

export async function getCurrentSessionUser() {
    const cookieStore = await cookies()
    const session = cookieStore.get('session')

    if (!session) return null

    const payload = await verifySessionToken(session.value)
    if (!payload.userId) return null

    return prisma.user.findUnique({
        where: { id: payload.userId },
        select: publicUserSelect,
    })
}

export async function ensureAdmin() {
    const user = await getCurrentSessionUser()
    if (!user || user.role !== 'Admin') {
        throw new Error('Unauthorized: Administrative access required.');
    }
    return user;
}

export function normalizeRole(role: unknown) {
    return role === 'Admin' ? 'Admin' : 'user'
}
