'use server'
import prisma from '@/lib/prisma'
import { ActionResponse } from '@/interfaces'

export async function handleGymScan(userId: string): Promise<ActionResponse> {
    try {
        return await prisma.$transaction<ActionResponse>(async (tx: any) => {
            const [user]: any = await tx.$queryRaw`SELECT id, name FROM "User" WHERE id = ${userId} FOR UPDATE`;
            if (!user) {
                return { success: false, error: 'User not found' };
            }

            const activeLog = await tx.gymLog.findFirst({
                where: { userId: userId, exitTime: null }
            });

            if (activeLog) {
                const exitTime = new Date();
                const entryTime = new Date(activeLog.entryTime);
                const durationMs = exitTime.getTime() - entryTime.getTime();
                const durationHours = parseFloat((durationMs / (1000 * 60 * 60)).toFixed(2));

                const updatedLog = await tx.gymLog.update({
                    where: { id: activeLog.id },
                    data: { exitTime, duration: durationHours }
                });

                return {
                    success: true,
                    data: {
                        type: 'check-out',
                        user: user.name,
                        duration: durationHours,
                        log: updatedLog
                    }
                };
            } else {
                const newLog = await tx.gymLog.create({
                    data: { userId: userId, entryTime: new Date() }
                });

                return {
                    success: true,
                    data: {
                        type: 'check-in',
                        user: user.name,
                        log: newLog
                    }
                };
            }
        });
    }
    catch (error: any) {
        console.error('Gym scan error:', error)
        return { success: false, error: error.message || 'Failed to process gym scan' }
    }
}

export async function getGymStats(userId: string): Promise<ActionResponse> {
    try {
        const logs = await prisma.gymLog.findMany({
            where: { userId }, orderBy: { entryTime: 'desc' }
        })

        const completedLogs = logs.filter(log => log.exitTime !== null)

        const totalHours = completedLogs.reduce((acc, log) => acc + (log.duration || 0), 0)
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)

        const weeklyHours = completedLogs
            .filter(log => new Date(log.entryTime) >= weekAgo).reduce((acc, log) => acc + (log.duration || 0), 0)

        return {
            success: true,
            data: {
                totalHours: totalHours.toFixed(1),
                weeklyHours: weeklyHours.toFixed(1),
                sessionsCount: logs.length,
                history: logs.slice(0, 10).map(log => ({
                    id: log.id, date: new Date(log.entryTime).toLocaleDateString(),
                    entryTime: new Date(log.entryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    exitTime: log.exitTime ? new Date(log.exitTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'In Progress',
                    duration: log.duration ? `${log.duration} h` : '--', status: log.exitTime ? 'Completed' : 'Active'
                }))
            }
        }
    }
    catch (error: any) {
        console.error('Get gym stats error:', error)
        return { success: false, error: error.message || 'Failed to get gym stats' }
    }
}
