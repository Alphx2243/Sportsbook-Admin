'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { ActionResponse } from '@/interfaces'

export async function createApplication(data: any): Promise<ActionResponse> {
    try {
        const application = await prisma.guideApplication.create({
            data: {
                email: data.email, option: data.option,
                sportName: data.sportname, level: data.level,
                resolved: data.resolved ?? false, time: data.time,
                description: data.description,
                avDays: Array.isArray(data.avdays) ? data.avdays.join(',') : data.avdays,
            },
        })
        revalidatePath('/')
        return { success: true, data: application }
    }
    catch (error: any) {
        console.error('Create application error:', error); 
        return { success: false, error: error.message || 'Failed to create application' }
    }
}

export async function getApplications(): Promise<ActionResponse<any[]>> {
    try {
        const applications = await prisma.guideApplication.findMany({
            where: { resolved: false },
            orderBy: { createdAt: 'desc' },
        })
        return { success: true, data: applications }
    } catch (error: any) {
        console.error('Get applications error:', error)
        return { success: false, error: error.message || 'Failed to get applications' }
    }
}

export async function deleteApplication(id: string): Promise<ActionResponse> {
    try {
        await prisma.guideApplication.delete({
            where: { id },
        })
        revalidatePath('/')
        return { success: true, data: null }
    } catch (error: any) {
        console.error('Delete application error:', error)
        return { success: false, error: error.message || 'Failed to delete application' }
    }
}

