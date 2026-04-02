'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { ActionResponse } from '@/interfaces'

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
        // Notify socket of new application
        await notifySocketUpdate(data.sportname, 'availability_changed');
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
        const application = await prisma.guideApplication.delete({
            where: { id },
        })
        revalidatePath('/')
        // Notify socket of application removal
        await notifySocketUpdate(application.sportName, 'availability_changed');
        return { success: true, data: null }
    } catch (error: any) {
        console.error('Delete application error:', error)
        return { success: false, error: error.message || 'Failed to delete application' }
    }
}
