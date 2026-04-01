'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { ActionResponse } from '@/interfaces'

export async function createInvite(data: any): Promise<ActionResponse> {
    try {
        const invite = await prisma.invite.create({
            data: {
                sport: data.sport, venue: data.venue,
                date: data.date, time: data.time,
                email: data.email, name: data.name,
                mobileNumber: data.mobilenumber || data.mobileNumber || '', 
                show: data.show ?? true,
            },
        })
        revalidatePath('/')
        return { success: true, data: invite }
    }
    catch (error: any) {
        console.error('Create invite error:', error)
        return { success: false, error: error.message || 'Failed to create invite' }
    }
}

export async function getInvites(): Promise<ActionResponse<any[]>> {
    try {
        const invites = await prisma.invite.findMany({ where: { show: true }, orderBy: { createdAt: 'desc' }, })
        return { success: true, data: invites }
    }
    catch (error: any) {
        console.error('Get invites error:', error)
        return { success: false, error: error.message || 'Failed to get invites' }
    }
}

export async function editInvite(id: string): Promise<ActionResponse> {
    try {
        const invite = await prisma.invite.update({ where: { id }, data: { show: false }, })
        revalidatePath('/')
        return { success: true, data: invite }
    }
    catch (error: any) {
        console.error('Edit invite error:', error)
        return { success: false, error: error.message || 'Failed to edit invite' }
    }
}

export async function deleteInvite(id: string): Promise<ActionResponse> {
    try {
        await prisma.invite.delete({ where: { id }, })
        revalidatePath('/')
        return { success: true, data: null }
    }
    catch (error: any) {
        console.error('Delete invite error:', error); 
        return { success: false, error: error.message || 'Failed to delete invite' }
    }
}
