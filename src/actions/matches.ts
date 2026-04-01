'use server'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { ActionResponse } from '@/interfaces'

export async function createMatch(data: any): Promise<ActionResponse> {
    try {
        const match = await prisma.match.create({
            data: {
                sportName: data.sportName, team1: data.team1,
                team2: data.team2, score1: data.score1,
                score2: data.score2, status: data.status,
            },
        })
        revalidatePath('/live-scores')
        return { success: true, data: match }
    }
    catch (error: any) {
        console.error('Create match error:', error)
        return { success: false, error: error.message || 'Failed to create match' }
    }
}

export async function getMatches(filters: { status?: string; sportName?: string } = {}): Promise<ActionResponse<{ documents: any[], total: number }>> {
    try {
        const where: any = {}
        if (filters.status) where.status = filters.status
        if (filters.sportName) where.sportName = filters.sportName

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
        const match = await prisma.match.update({
            where: { id },
            data: {
                score1: data.score1, score2: data.score2,
                status: data.status,
            },
        })
        revalidatePath('/live-scores')
        return { success: true, data: match }
    }
    catch (error: any) {
        console.error('Update match error:', error)
        return { success: false, error: error.message || 'Failed to update match' }
    }
}

export async function deleteMatch(id: string): Promise<ActionResponse> {
    try {
        await prisma.match.delete({ where: { id }, })
        revalidatePath('/live-scores')
        return { success: true, data: null }
    }
    catch (error: any) {
        console.error('Delete match error:', error)
        return { success: false, error: error.message || 'Failed to delete match' }
    }
}
