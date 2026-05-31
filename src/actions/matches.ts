'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { ActionResponse } from '@/types/interfaces'
import { ensureAdmin } from '@/lib/auth-utils'
import { requireServerEnv } from '@/lib/env'
import { matchStatus, nonNegativeInt, requiredString } from '@/lib/validation'

async function notifyMatchesUpdate() {
    const url = `${process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3005'}/notify-matches`;
    const secret = requireServerEnv('SOCKET_INTERNAL_SECRET');

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

export async function createMatch(data: any): Promise<ActionResponse> {
    try {
        await ensureAdmin()
        const match = await prisma.match.create({
            data: {
                sportName: requiredString(data.sportName, 'Sport name'),
                team1: requiredString(data.team1, 'Team 1'),
                team2: requiredString(data.team2, 'Team 2'),
                score1: nonNegativeInt(data.score1, 'Score 1', 0).toString(),
                score2: nonNegativeInt(data.score2, 'Score 2', 0).toString(),
                status: matchStatus(data.status),
            },
        })
        revalidatePath('/live-scores')
        await notifyMatchesUpdate();
        return { success: true, data: match }
    }
    catch (error: any) {
        console.error('Create match error:', error)
        return { success: false, error: error.message || 'Failed to create match' }
    }
}

export async function getMatches(filters: { status?: string; sportName?: string } = {}): Promise<ActionResponse<{ documents: any[], total: number }>> {
    try {
        await ensureAdmin()
        const where: any = {}
        if (filters.status) where.status = matchStatus(filters.status)
        if (filters.sportName) where.sportName = requiredString(filters.sportName, 'Sport name')

        const matches = await prisma.match.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        })
        return { success: true, data: { documents: matches, total: matches.length } }
    }
    catch (error: any) {
        console.error('Get matches error:', error)
        return { success: false, error: error.message || 'Failed to get matches' }
    }
}

export async function updateMatch(id: string, data: any): Promise<ActionResponse> {
    try {
        await ensureAdmin()
        const match = await prisma.match.update({
            where: { id },
            data: {
                score1: data.score1 !== undefined ? nonNegativeInt(data.score1, 'Score 1').toString() : undefined,
                score2: data.score2 !== undefined ? nonNegativeInt(data.score2, 'Score 2').toString() : undefined,
                status: data.status !== undefined ? matchStatus(data.status) : undefined,
            },
        })
        revalidatePath('/live-scores')
        await notifyMatchesUpdate();
        return { success: true, data: match }
    }
    catch (error: any) {
        console.error('Update match error:', error)
        return { success: false, error: error.message || 'Failed to update match' }
    }
}

export async function deleteMatch(id: string): Promise<ActionResponse> {
    try {
        await ensureAdmin()
        await prisma.match.delete({ where: { id }, })
        revalidatePath('/live-scores')
        await notifyMatchesUpdate();
        return { success: true, data: null }
    }
    catch (error: any) {
        console.error('Delete match error:', error)
        return { success: false, error: error.message || 'Failed to delete match' }
    }
}
